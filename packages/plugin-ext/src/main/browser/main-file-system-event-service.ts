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

import { interfaces } from 'inversify';
import { RPCProtocol } from '../../common/rpc-protocol';
import { MAIN_RPC_CONTEXT, FileSystemEvents } from '../../common/plugin-api-rpc';
import { DisposableCollection as DisposableStore } from '@theia/core/lib/common/disposable';
import { PluginFileService } from './plugin-file-service';
import { FileChangeType, FileOperation } from '../../common/files';

export class MainFileSystemEventService {

    private readonly _listener = new DisposableStore();
    protected readonly fileService: PluginFileService;
    protected readonly textFileService: ITextFileService;
    protected readonly workingCopyFileService: IWorkingCopyFileService;

    constructor(
        rpc: RPCProtocol,
        container: interfaces.Container
    ) {
        const proxy = rpc.getProxy(MAIN_RPC_CONTEXT.ExtHostFileSystemEventService);
        this.fileService = container.get(PluginFileService);

        // file system events - (changes the editor and other make)
        const events: FileSystemEvents = {
            created: [],
            changed: [],
            deleted: []
        };
        this._listener.push(this.fileService.onDidFilesChange(event => {
            for (const change of event.changes) {
                switch (change.type) {
                    case FileChangeType.ADDED:
                        events.created.push(change.resource);
                        break;
                    case FileChangeType.UPDATED:
                        events.changed.push(change.resource);
                        break;
                    case FileChangeType.DELETED:
                        events.deleted.push(change.resource);
                        break;
                }
            }

            proxy.$onFileEvent(events);
            events.created.length = 0;
            events.changed.length = 0;
            events.deleted.length = 0;
        }));

        // BEFORE file operation
        workingCopyFileService.addFileOperationParticipant({
            participate: (target, source, operation, progress, timeout, token) => proxy.$onWillRunFileOperation(operation, target, source, timeout, token)
        });

        // AFTER file operation
        this._listener.push(textFileService.onDidCreateTextFile(e => proxy.$onDidRunFileOperation(FileOperation.CREATE, e.resource, undefined)));
        this._listener.push(workingCopyFileService.onDidRunWorkingCopyFileOperation(e => proxy.$onDidRunFileOperation(e.operation, e.target, e.source)));
    }

    dispose(): void {
        this._listener.dispose();
    }
}
