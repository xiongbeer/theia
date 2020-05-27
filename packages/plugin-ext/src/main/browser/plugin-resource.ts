/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { injectable, inject } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { Resource, ResourceVersion, ResourceResolver, ResourceError, ResourceSaveOptions } from '@theia/core/lib/common/resource';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { PluginFileService } from './plugin-file-service';
import { FileOperationError, FileOperationResult, IFileContent, FileOperation } from '../../common/files';
import { VSBuffer } from '../../common/buffer';

export interface PluginResourceVersion extends ResourceVersion {
    readonly stat: IFileContent;
}
export namespace PluginResourceVersion {
    export function is(version: ResourceVersion | undefined): version is PluginResourceVersion {
        return !!version && ('mtime' in version || 'etag' in version);
    }
}

export class PluginResource implements Resource {

    protected readonly toDispose = new DisposableCollection();
    protected readonly onDidChangeContentsEmitter = new Emitter<void>();
    readonly onDidChangeContents: Event<void> = this.onDidChangeContentsEmitter.event;

    protected _version: PluginResourceVersion | undefined;
    get version(): PluginResourceVersion | undefined {
        return this._version;
    }

    protected uriString: string;

    constructor(
        readonly uri: URI,
        protected readonly fileService: PluginFileService
    ) {
        this.uriString = this.uri.toString();
        this.toDispose.push(this.onDidChangeContentsEmitter);
    }

    async init(): Promise<void> {
        const stat = await this.fileService.resolve(this.uri['codeUri'], { resolveMetadata: true });
        if (stat && stat.isDirectory) {
            throw new Error('The given uri is a directory: ' + this.uriString);
        }

        this.toDispose.push(this.fileService.onDidFilesChange(event => {
            if (event.contains(this.uri['codeUri'])) {
                this.sync();
            }
        }));
        this.fileService.onDidRunOperation(e => {
            if ((e.isOperation(FileOperation.DELETE) || e.isOperation(FileOperation.MOVE)) && new URI(e.resource).isEqualOrParent(this.uri)) {
                this.sync();
            }
        });
        try {
            this.toDispose.push(this.fileService.watch(this.uri['codeUri']));
        } catch (e) {
            console.error(e);
        }
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    // TODO encoding?
    async readContents(options?: { encoding?: string }): Promise<string> {
        try {
            const etag = this._version?.stat.etag;
            const stat = await this.fileService.readFile(this.uri['codeUri'], { etag });
            const content = stat.value.toString();
            this._version = { stat };
            return content;
        } catch (e) {
            if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_MODIFIED_SINCE) {
                // TODO should not we throw something like `ResourceError.FileNotModified`? we will have to review all clients but it could reduce the memory footprint
                return this._version?.stat.value.toString() || '';
            }
            if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
                this._version = undefined;
                const { message, stack } = e;
                throw ResourceError.NotFound({
                    message, stack,
                    data: {
                        uri: this.uri
                    }
                });
            }
            throw e;
        }
    }

    // TODO encoding?
    async saveContents(content: string, options?: ResourceSaveOptions): Promise<void> {
        try {
            let resolvedOptions = options;
            if (options && options.overwriteEncoding) {
                resolvedOptions = {
                    ...options,
                    encoding: options.overwriteEncoding
                };
                delete resolvedOptions.overwriteEncoding;
            }
            const stat = await this.doSaveContents(content, resolvedOptions);
            this._version = { stat };
        } catch (e) {
            if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
                const { message, stack } = e;
                throw ResourceError.OutOfSync({ message, stack, data: { uri: this.uri } });
            }
            throw e;
        }
    }
    protected async doSaveContents(content: string, options?: { encoding?: string, version?: ResourceVersion }): Promise<IFileContent> {
        const version = options?.version;
        const stat = PluginResourceVersion.is(version) ? version.stat : undefined;
        const value = VSBuffer.fromString(content);
        const newStat = await this.fileService.writeFile(this.uri['codeUri'], value, {
            etag: stat?.etag,
            mtime: stat?.mtime
        });
        return {
            ...stat,
            ...newStat,
            value
        };
    }

    // TODO encoding?
    // async guessEncoding(): Promise<string | undefined> {
    //     return this.fileService.guessEncoding(this.uriString);
    // }

    protected async sync(): Promise<void> {
        this.onDidChangeContentsEmitter.fire(undefined);
    }

}

@injectable()
export class PluginResourceResolver implements ResourceResolver {

    @inject(PluginFileService)
    protected readonly fileService: PluginFileService;

    async resolve(uri: URI): Promise<PluginResource> {
        if (this.fileService.canHandleResource(uri['codeUri'])) {
            throw new Error('The given uri is not supported: ' + uri);
        }
        const resource = new PluginResource(uri, this.fileService);
        await resource.init();
        return resource;
    }

}
