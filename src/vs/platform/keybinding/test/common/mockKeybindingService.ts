/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {IKeybindingService, IKeybindingContextKey, IKeybindingItem} from 'vs/platform/keybinding/common/keybindingService';
import {Keybinding} from 'vs/base/common/keyCodes';
import {IHTMLContentElement} from 'vs/base/common/htmlContent';
import {TPromise} from 'vs/base/common/winjs.base';

class MockKeybindingContextKey<T> implements IKeybindingContextKey<T> {
	private _key: string;
	private _defaultValue: T;
	private _value: T;

	constructor(key: string, defaultValue: T) {
		this._key = key;
		this._defaultValue = defaultValue;
		this._value = this._defaultValue;
	}

	public set(value: T): void {
		this._value = value;
	}

	public reset(): void {
		this._value = this._defaultValue;
	}
}

export class MockKeybindingService implements IKeybindingService {
	public serviceId = IKeybindingService;

	public dispose(): void { }
	public executeCommand(commandId: string, args: any): TPromise<any> { return; }

	public createKey<T>(key: string, defaultValue: T): IKeybindingContextKey<T> {
		return new MockKeybindingContextKey(key, defaultValue);
	}

	public getLabelFor(keybinding:Keybinding): string {
		return keybinding._toUSLabel();
	}

	public getHTMLLabelFor(keybinding:Keybinding): IHTMLContentElement[] {
		return keybinding._toUSHTMLLabel();
	}

	public getElectronAcceleratorFor(keybinding:Keybinding): string {
		return keybinding._toElectronAccelerator();
	}

	public createScoped(domNode: HTMLElement): IKeybindingService {
		return this;
	}

	public getDefaultKeybindings(): string {
		return null;
	}

	public lookupKeybindings(commandId: string): Keybinding[] {
		return [];
	}

	public customKeybindingsCount(): number {
		return 0;
	}
}
