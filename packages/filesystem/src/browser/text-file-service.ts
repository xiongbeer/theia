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
import { FileStatWithMetadata } from '../common/files';
import { FileService } from './file-service';
import { EncodingService, WriteTextFileOptions } from './encoding-service';

/**
 * TODO: inline in FileService?
 */
@injectable()
export class TextFileService {

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(EncodingService)
    protected readonly encodingService: EncodingService;

    async write(resource: URI, value: string, options?: WriteTextFileOptions): Promise<FileStatWithMetadata> {
        const encoding = await this.encodingService.getWriteEncoding(resource, options);
        const encoded = this.encodingService.encode(value, encoding);
        return this.fileService.writeFile(resource, encoded, options);
    }

}
