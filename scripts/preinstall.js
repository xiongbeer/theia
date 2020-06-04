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
'use-strict';

// @ts-check

let hasError = false;

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const regexp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const match = process.versions.node.match(regexp);
const [major, minor] = (match || []).slice(1).map(value => parseInt(value, 10));

const error = (message) => console.error('\033[1;31m ' + message + ' \033[0;0m');
const warn = (message) => console.error('\033[1;33m ' + message + ' \033[0;0m');

if (major < 10 || major >= 13) {
    error(`[Theia]: Invalid Node.js version: ${process.versions.node}. Please use Node.js >=10 and <=12.`);
    hasError = true;
}

// The recommended Node.js version comes from the actual electron version. (>=12.14.1)
if (!hasError) {
    const minimum = '12.14.1';
    const message = `[Theia]: Your Node.js version is out of date: '${process.versions.node}'. The support of your Node.js version will be dropped. Please use Node.js >=${minimum}.`
    if (major < 12) {
        warn(message);
    } else if (major == 12) {
        if (minor < 14) {
            warn(message);
        }
    }
}

if (hasError) {
    console.error('');
    process.exit(1);
}
