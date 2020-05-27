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

import { URI } from 'vscode-uri';
import { OS } from '@theia/core/lib/common/os';
import CoreURI from '@theia/core/lib/common/uri';
import { Schemes as Schemas } from './/uri-components';

// TODO should not it be backend based?
const isLinux = OS.type() === OS.Type.Linux;
function _hasToIgnoreCase(resource: URI | undefined): boolean {
    // A file scheme resource is in the same platform as code, so ignore case for non linux platforms
    // Resource can be from another platform. Lowering the case as an hack. Should come from File system provider
    return resource && resource.scheme === Schemas.file ? !isLinux : true;
}

export const isAbsolutePath = (resource: URI) => new CoreURI(resource).path.isAbsolute;
export const isEqual = (resource: URI, resource2: URI, caseInsensitivePath: boolean = _hasToIgnoreCase(resource)) => {
    let uri = new CoreURI(resource);
    let uri2 = new CoreURI(resource2);
    if (caseInsensitivePath) {
        uri = uri.withPath(uri.path.toString().toLowerCase());
        uri2 = uri2.withPath(uri2.path.toString().toLowerCase());
    }
    const relativePath = uri.relative(uri2);
    return !!relativePath && relativePath.toString() === '';
};
export const isEqualOrParent = (resource: URI, resource2: URI, caseInsensitivePath: boolean = _hasToIgnoreCase(resource)) => {
    let uri = new CoreURI(resource);
    let uri2 = new CoreURI(resource2);
    if (caseInsensitivePath) {
        uri = uri.withPath(uri.path.toString().toLowerCase());
        uri2 = uri2.withPath(uri2.path.toString().toLowerCase());
    }
    return uri.isEqualOrParent(uri2);
};
export const dirname = (resource: URI) => new CoreURI(resource).parent['codeUri'];
export const basename = (resource: URI) => new CoreURI(resource).path.base;
export const joinPath = (resource: URI, ...pathFragment: string[]) => {
    const coreUri = new CoreURI(resource);
    return coreUri.withPath(coreUri.path.join(...pathFragment))['codeUri'];
};
export const getBaseLabel = (resource: URI) => new CoreURI(resource).displayName;
