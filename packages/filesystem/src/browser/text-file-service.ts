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

import { injectable, inject } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { WriteFileOptions, FileStatWithMetadata, FileOperationError, FileOperationResult } from '../common/files';
import { FileService } from './file-service';

export interface WriteTextFileOptions extends WriteFileOptions {

	/**
	 * The encoding to use when updating a file.
	 */
    encoding?: string;

	/**
	 * If set to true, will enforce the selected encoding and not perform any detection using BOMs.
	 */
    overwriteEncoding?: boolean;

	/**
	 * Whether to overwrite a file even if it is readonly.
	 */
    overwriteReadonly?: boolean;

}

/**
 * TODO: inline in FileService?
 */
@injectable()
export class TextFileService {

    @inject(FileService)
    protected readonly fileService: FileService;

    async write(resource: URI, value: string, options?: WriteTextFileOptions): Promise<FileStatWithMetadata> {
        // check for overwriteReadonly property (only supported for local file://)
        try {
            if (options?.overwriteReadonly && resource.scheme === 'file' && await exists(resource)) {
                const fileStat = await stat(resource.fsPath);

                // try to change mode to writeable
                await chmod(resource.fsPath, fileStat.mode | 128);
            }
        } catch (error) {
            // ignore and simply retry the operation
        }

        // check for writeElevated property (only supported for local file://)
        if (options?.writeElevated && resource.scheme === 'file') {
            return this.writeElevated(resource, value, options);
        }

        try {

            // check for encoding
            const { encoding, addBOM } = await this.encoding.getWriteEncoding(resource, options);

            // return to parent when encoding is standard
            if (encoding === UTF8 && !addBOM) {
                return await super.write(resource, value, options);
            } else {
                return await this.fileService.writeFile(resource, this.getEncodedReadable(value, encoding, addBOM), options);
            }
        } catch (error) {

            // In case of permission denied, we need to check for readonly
            if ((<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_PERMISSION_DENIED) {
                let isReadonly = false;
                try {
                    const fileStat = await stat(resource.fsPath);
                    if (!(fileStat.mode & 128)) {
                        isReadonly = true;
                    }
                } catch {
                    // ignore - rethrow original error
                }

                if (isReadonly) {
                    throw new FileOperationError('File is Read Only', FileOperationResult.FILE_READ_ONLY, options);
                }
            }

            throw error;
        }
    }

}
