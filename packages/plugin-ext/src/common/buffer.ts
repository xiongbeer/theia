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

import * as streams from './stream';
import * as strings from '@theia/languages/lib/common/language-selector/strings';

const hasBuffer = (typeof Buffer !== 'undefined');
const hasTextEncoder = (typeof TextEncoder !== 'undefined');
const hasTextDecoder = (typeof TextDecoder !== 'undefined');

let textEncoder: TextEncoder | null;
let textDecoder: TextDecoder | null;

export class VSBuffer {

    static alloc(byteLength: number): VSBuffer {
        if (hasBuffer) {
            return new VSBuffer(Buffer.allocUnsafe(byteLength));
        } else {
            return new VSBuffer(new Uint8Array(byteLength));
        }
    }

    static wrap(actual: Uint8Array): VSBuffer {
        if (hasBuffer && !(Buffer.isBuffer(actual))) {
            // https://nodejs.org/dist/latest-v10.x/docs/api/buffer.html#buffer_class_method_buffer_from_arraybuffer_byteoffset_length
            // Create a zero-copy Buffer wrapper around the ArrayBuffer pointed to by the Uint8Array
            actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
        }
        return new VSBuffer(actual);
    }

    static fromString(source: string): VSBuffer {
        if (hasBuffer) {
            return new VSBuffer(Buffer.from(source));
        } else if (hasTextEncoder) {
            if (!textEncoder) {
                textEncoder = new TextEncoder();
            }
            return new VSBuffer(textEncoder.encode(source));
        } else {
            return new VSBuffer(strings.encodeUTF8(source));
        }
    }

    static concat(buffers: VSBuffer[], totalLength?: number): VSBuffer {
        if (typeof totalLength === 'undefined') {
            totalLength = 0;
            for (let i = 0, len = buffers.length; i < len; i++) {
                totalLength += buffers[i].byteLength;
            }
        }

        const ret = VSBuffer.alloc(totalLength);
        let offset = 0;
        for (let i = 0, len = buffers.length; i < len; i++) {
            const element = buffers[i];
            ret.set(element, offset);
            offset += element.byteLength;
        }

        return ret;
    }

    readonly buffer: Uint8Array;
    readonly byteLength: number;

    private constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.byteLength = this.buffer.byteLength;
    }

    toString(): string {
        if (hasBuffer) {
            return this.buffer.toString();
        } else if (hasTextDecoder) {
            if (!textDecoder) {
                textDecoder = new TextDecoder();
            }
            return textDecoder.decode(this.buffer);
        } else {
            return strings.decodeUTF8(this.buffer);
        }
    }

    slice(start?: number, end?: number): VSBuffer {
        // IMPORTANT: use subarray instead of slice because TypedArray#slice
        // creates shallow copy and NodeBuffer#slice doesn't. The use of subarray
        // ensures the same, performant, behaviour.
        return new VSBuffer(this.buffer.subarray(start, end));
    }

    set(array: VSBuffer, offset?: number): void;
    set(array: Uint8Array, offset?: number): void;
    set(array: VSBuffer | Uint8Array, offset?: number): void {
        if (array instanceof VSBuffer) {
            this.buffer.set(array.buffer, offset);
        } else {
            this.buffer.set(array, offset);
        }
    }

}

export interface VSBufferReadable extends streams.Readable<VSBuffer> { }

export interface VSBufferReadableStream extends streams.ReadableStream<VSBuffer> { }

export interface VSBufferWriteableStream extends streams.WriteableStream<VSBuffer> { }

export function readableToBuffer(readable: VSBufferReadable): VSBuffer {
    return streams.consumeReadable<VSBuffer>(readable, chunks => VSBuffer.concat(chunks));
}

export function bufferToReadable(buffer: VSBuffer): VSBufferReadable {
    return streams.toReadable<VSBuffer>(buffer);
}

export function streamToBuffer(stream: streams.ReadableStream<VSBuffer>): Promise<VSBuffer> {
    return streams.consumeStream<VSBuffer>(stream, chunks => VSBuffer.concat(chunks));
}
export function bufferToStream(buffer: VSBuffer): streams.ReadableStream<VSBuffer> {
    return streams.toStream<VSBuffer>(buffer, chunks => VSBuffer.concat(chunks));
}

export function newWriteableBufferStream(): streams.WriteableStream<VSBuffer> {
    return streams.newWriteableStream<VSBuffer>(chunks => VSBuffer.concat(chunks));
}
