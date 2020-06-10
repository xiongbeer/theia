/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as iconv from 'iconv-lite';
import { injectable, inject, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { WriteFileOptions } from '../common/files';
import { FileSystemPreferences } from './filesystem-preferences';
import { TextBuffer } from '../common/buffer';
import { FileService } from './file-service';

export const UTF8 = 'utf8';
export const UTF8_with_bom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';

export const UTF16be_BOM = [0xFE, 0xFF];
export const UTF16le_BOM = [0xFF, 0xFE];
export const UTF8_BOM = [0xEF, 0xBB, 0xBF];

export interface WriteTextFileOptions extends WriteFileOptions {

	/**
	 * The encoding to use when updating a file.
	 */
    encoding?: string;

	/**
	 * If set to true, will enforce the selected encoding and not perform any detection using BOMs.
	 */
    overwriteEncoding?: boolean;

}

export interface ResourceEncoding {
    encoding: string
    hasBOM: boolean
}

export interface EncodingOverride {
    parent?: URI;
    extension?: string;
    encoding: string;
}

@injectable()
export class EncodingService {

    // TODO support encoding overrides
    protected readonly encodingOverrides: EncodingOverride[] = [];

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(FileSystemPreferences)
    protected readonly preferences: FileSystemPreferences;

    encode(value: string, options?: ResourceEncoding): TextBuffer {
        let encoding = options?.encoding;
        const addBOM = options?.hasBOM;
        encoding = this.toIconvEncoding(encoding);
        if (encoding === UTF8 && !addBOM) {
            return TextBuffer.fromString(value);
        }
        const buffer = iconv.encode(value, encoding, { addBOM });
        return TextBuffer.wrap(buffer);
    }

    async getWriteEncoding(resource: URI, options?: WriteTextFileOptions): Promise<ResourceEncoding> {
        const { encoding, hasBOM } = this.getPreferredWriteEncoding(resource, options ? options.encoding : undefined);

        // Some encodings come with a BOM automatically
        if (hasBOM) {
            return { encoding, hasBOM: true };
        }

        // Ensure that we preserve an existing BOM if found for UTF8
        // unless we are instructed to overwrite the encoding
        const overwriteEncoding = options?.overwriteEncoding;
        if (!overwriteEncoding && encoding === UTF8) {
            try {
                const buffer = (await this.fileService.readFile(resource, { length: UTF8_BOM.length })).value;
                if (this.detectEncodingByBOMFromBuffer(buffer, buffer.byteLength) === UTF8_with_bom) {
                    return { encoding, hasBOM: true };
                }
            } catch (error) {
                // ignore - file might not exist
            }
        }

        return { encoding, hasBOM: false };
    }

    getPreferredWriteEncoding(resource: URI, preferredEncoding?: string): ResourceEncoding {
        const resourceEncoding = this.getEncodingForResource(resource, preferredEncoding);

        return {
            encoding: resourceEncoding,
            hasBOM: resourceEncoding === UTF16be || resourceEncoding === UTF16le || resourceEncoding === UTF8_with_bom // enforce BOM for certain encodings
        };
    }

    private getEncodingForResource(resource: URI, preferredEncoding?: string): string {
        let fileEncoding: string;

        const override = this.getEncodingOverride(resource);
        if (override) {
            fileEncoding = override; // encoding override always wins
        } else if (preferredEncoding) {
            fileEncoding = preferredEncoding; // preferred encoding comes second
        } else {
            fileEncoding = this.preferences.get('files.encoding', undefined, resource.toString());
        }

        if (!fileEncoding || !this.exists(fileEncoding)) {
            return UTF8; // the default is UTF 8
        }

        return this.toIconvEncoding(fileEncoding);
    }

    private getEncodingOverride(resource: URI): string | undefined {
        if (this.encodingOverrides && this.encodingOverrides.length) {
            for (const override of this.encodingOverrides) {

                // check if the resource is child of encoding override path
                if (override.parent && resource.isEqualOrParent(override.parent)) {
                    return override.encoding;
                }

                // check if the resource extension is equal to encoding override
                if (override.extension && resource.path.ext === `.${override.extension}`) {
                    return override.encoding;
                }
            }
        }

        return undefined;
    }

    protected exists(encoding: string): boolean {
        encoding = this.toIconvEncoding(encoding);
        return iconv.encodingExists(encoding);
    }

    protected toIconvEncoding(encoding?: string): string {
        if (encoding === UTF8_with_bom || !encoding) {
            return UTF8; // iconv does not distinguish UTF 8 with or without BOM, so we need to help it
        }
        return encoding;
    }

    protected detectEncodingByBOMFromBuffer(buffer: TextBuffer, bytesRead: number): typeof UTF8_with_bom | typeof UTF16le | typeof UTF16be | undefined {
        if (!buffer || bytesRead < UTF16be_BOM.length) {
            return undefined;
        }

        const b0 = buffer.readUInt8(0);
        const b1 = buffer.readUInt8(1);

        // UTF-16 BE
        if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
            return UTF16be;
        }

        // UTF-16 LE
        if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
            return UTF16le;
        }

        if (bytesRead < UTF8_BOM.length) {
            return undefined;
        }

        const b2 = buffer.readUInt8(2);

        // UTF-8
        if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
            return UTF8_with_bom;
        }

        return undefined;
    }

}
