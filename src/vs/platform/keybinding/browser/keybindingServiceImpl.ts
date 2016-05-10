/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'vs/css!./keybindings';
import * as nls from 'vs/nls';
import {IHTMLContentElement} from 'vs/base/common/htmlContent';
import {KeyCode, Keybinding} from 'vs/base/common/keyCodes';
import {IDisposable, dispose} from 'vs/base/common/lifecycle';
import Severity from 'vs/base/common/severity';
import {isFalsyOrEmpty} from 'vs/base/common/arrays';
import {TPromise} from 'vs/base/common/winjs.base';
import * as dom from 'vs/base/browser/dom';
import {IKeyboardEvent, StandardKeyboardEvent} from 'vs/base/browser/keyboardEvent';
import {IInstantiationService} from 'vs/platform/instantiation/common/instantiation';
import {KeybindingResolver} from 'vs/platform/keybinding/common/keybindingResolver';
import {ICommandHandler, ICommandHandlerDescription, IKeybindingContextKey, IKeybindingItem, IKeybindingScopeLocation, IKeybindingService, SET_CONTEXT_COMMAND_ID} from 'vs/platform/keybinding/common/keybindingService';
import {KeybindingsRegistry} from 'vs/platform/keybinding/common/keybindingsRegistry';
import {IStatusbarService} from 'vs/platform/statusbar/common/statusbar';
import {IMessageService} from 'vs/platform/message/common/message';
import {IConfigurationService} from 'vs/platform/configuration/common/configuration';
import {ServicesAccessor} from 'vs/platform/instantiation/common/instantiation';

let KEYBINDING_CONTEXT_ATTR = 'data-keybinding-context';

export class KeybindingContext {
	private _parent: KeybindingContext;
	private _value: any;
	private _id: number;

	constructor(id: number, parent: KeybindingContext) {
		this._id = id;
		this._parent = parent;
		this._value = Object.create(null);
		this._value['_contextId'] = id;
	}

	public setValue(key: string, value: any): void {
		//		console.log('SET ' + key + ' = ' + value + ' ON ' + this._id);
		this._value[key] = value;
	}

	public removeValue(key: string): void {
		//		console.log('REMOVE ' + key + ' FROM ' + this._id);
		delete this._value[key];
	}

	public fillInContext(bucket: any): void {
		if (this._parent) {
			this._parent.fillInContext(bucket);
		}
		for (let key in this._value) {
			bucket[key] = this._value[key];
		}
	}
}

export class ConfigurationContext {

	private _subscription: IDisposable;
	private _values: any;

	constructor(configurationService: IConfigurationService) {
		this._subscription = configurationService.onDidUpdateConfiguration(e => this._updateConfigurationContext(e.config));
		this._updateConfigurationContext(configurationService.getConfiguration());
	}

	public dispose() {
		this._subscription.dispose();
	}

	private _updateConfigurationContext(config: any) {
		this._values = Object.create(null);
		const walk = (obj: any, keys: string[]) => {
			for (let key in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, key)) {
					keys.push(key);
					let value = obj[key];
					if (typeof value === 'boolean') {
						this._values[keys.join('.')] = value;
					} else if (typeof value === 'object') {
						walk(value, keys);
					}
					keys.pop();
				}
			}
		};
		walk(config, ['config']);
	}


	public fillInContext(bucket: any): void {
		if (this._values) {
			for (let key in this._values) {
				bucket[key] = this._values[key];
			}
		}
	}
}

class KeybindingContextKey<T> implements IKeybindingContextKey<T> {

	private _parent: AbstractKeybindingService;
	private _key: string;
	private _defaultValue: T;

	constructor(parent: AbstractKeybindingService, key: string, defaultValue: T) {
		this._parent = parent;
		this._key = key;
		this._defaultValue = defaultValue;
		if (typeof this._defaultValue !== 'undefined') {
			this._parent.setContext(this._key, this._defaultValue);
		}
	}

	public set(value: T): void {
		this._parent.setContext(this._key, value);
	}

	public reset(): void {
		if (typeof this._defaultValue === 'undefined') {
			this._parent.removeContext(this._key);
		} else {
			this._parent.setContext(this._key, this._defaultValue);
		}
	}

}

export abstract class AbstractKeybindingService {
	public serviceId = IKeybindingService;
	protected _myContextId: number;
	protected _instantiationService: IInstantiationService;

	constructor(myContextId: number) {
		this._myContextId = myContextId;
		this._instantiationService = null;
	}

	public createKey<T>(key: string, defaultValue: T): IKeybindingContextKey<T> {
		return new KeybindingContextKey(this, key, defaultValue);
	}

	public setInstantiationService(instantiationService: IInstantiationService): void {
		this._instantiationService = instantiationService;
	}

	public createScoped(domNode: IKeybindingScopeLocation): IKeybindingService {
		return new ScopedKeybindingService(this, domNode);
	}

	public setContext(key: string, value: any): void {
		this.getContext(this._myContextId).setValue(key, value);
	}

	public removeContext(key: string): void {
		this.getContext(this._myContextId).removeValue(key);
	}

	public hasCommand(commandId: string): boolean {
		return !!KeybindingsRegistry.getCommands()[commandId];
	}

	public abstract executeCommand(commandId: string, args: any): TPromise<any>;
	public abstract getLabelFor(keybinding: Keybinding): string;
	public abstract getHTMLLabelFor(keybinding: Keybinding): IHTMLContentElement[];
	public abstract getAriaLabelFor(keybinding: Keybinding): string;
	public abstract getElectronAcceleratorFor(keybinding: Keybinding): string;
	public abstract customKeybindingsCount(): number;
	public abstract getContext(contextId: number): KeybindingContext;
	public abstract createChildContext(parentContextId?: number): number;
	public abstract disposeContext(contextId: number): void;
	public abstract getDefaultKeybindings(): string;
	public abstract lookupKeybindings(commandId: string): Keybinding[];

}

export abstract class KeybindingService extends AbstractKeybindingService implements IKeybindingService {

	private _lastContextId: number;
	private _contexts: {
		[contextId: string]: KeybindingContext;
	};

	private _toDispose: IDisposable[] = [];
	private _configurationContext: ConfigurationContext;
	private _cachedResolver: KeybindingResolver;
	private _firstTimeComputingResolver: boolean;
	private _currentChord: number;
	private _currentChordStatusMessage: IDisposable;
	private _statusService: IStatusbarService;
	private _messageService: IMessageService;

	constructor(configurationService: IConfigurationService, messageService: IMessageService, statusService?: IStatusbarService) {
		super(0);
		this._lastContextId = 0;
		this._contexts = Object.create(null);
		this._contexts[String(this._myContextId)] = new KeybindingContext(this._myContextId, null);
		this._cachedResolver = null;
		this._firstTimeComputingResolver = true;
		this._currentChord = 0;
		this._currentChordStatusMessage = null;
		this._configurationContext = new ConfigurationContext(configurationService);
		this._toDispose.push(this._configurationContext);
		this._statusService = statusService;
		this._messageService = messageService;
	}

	protected _beginListening(domNode: HTMLElement): void {
		this._toDispose.push(dom.addDisposableListener(domNode, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let keyEvent = new StandardKeyboardEvent(e);
			this._dispatch(keyEvent);
		}));
	}

	private _getResolver(): KeybindingResolver {
		if (!this._cachedResolver) {
			this._cachedResolver = new KeybindingResolver(KeybindingsRegistry.getDefaultKeybindings(), this._getExtraKeybindings(this._firstTimeComputingResolver));
			this._firstTimeComputingResolver = false;
		}
		return this._cachedResolver;
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public getLabelFor(keybinding: Keybinding): string {
		return keybinding._toUSLabel();
	}

	public getHTMLLabelFor(keybinding: Keybinding): IHTMLContentElement[] {
		return keybinding._toUSHTMLLabel();
	}

	public getAriaLabelFor(keybinding: Keybinding): string {
		return keybinding._toUSAriaLabel();
	}

	public getElectronAcceleratorFor(keybinding: Keybinding): string {
		return keybinding._toElectronAccelerator();
	}

	protected updateResolver(): void {
		this._cachedResolver = null;
	}

	protected _getExtraKeybindings(isFirstTime: boolean): IKeybindingItem[] {
		return [];
	}

	public getDefaultKeybindings(): string {
		return this._getResolver().getDefaultKeybindings() + '\n\n' + this._getAllCommandsAsComment();
	}

	public customKeybindingsCount(): number {
		return 0;
	}

	public lookupKeybindings(commandId: string): Keybinding[] {
		return this._getResolver().lookupKeybinding(commandId);
	}

	private _getAllCommandsAsComment(): string {
		const commands = KeybindingsRegistry.getCommands();
		const unboundCommands: string[] = [];
		const boundCommands = this._getResolver().getDefaultBoundCommands();

		for (let id in commands) {
			if (id[0] === '_' || id.indexOf('vscode.') === 0) { // private command
				continue;
			}
			if (typeof commands[id].description === 'object'
				&& !isFalsyOrEmpty((<ICommandHandlerDescription>commands[id].description).args)) { // command with args
				continue;
			}
			if (boundCommands[id]) {
				continue;
			}
			unboundCommands.push(id);
		}

		let pretty = unboundCommands.sort().join('\n// - ');

		return '// ' + nls.localize('unboundCommands', "Here are other available commands: ") + '\n// - ' + pretty;
	}

	protected _getCommandHandler(commandId: string): ICommandHandler {
		return KeybindingsRegistry.getCommands()[commandId];
	}

	private _dispatch(e: IKeyboardEvent): void {
		let isModifierKey = (e.keyCode === KeyCode.Ctrl || e.keyCode === KeyCode.Shift || e.keyCode === KeyCode.Alt || e.keyCode === KeyCode.Meta);
		if (isModifierKey) {
			return;
		}

		let contextValue = Object.create(null);
		this.getContext(this._findContextAttr(e.target)).fillInContext(contextValue);
		this._configurationContext.fillInContext(contextValue);
		// console.log(JSON.stringify(contextValue, null, '\t'));

		let resolveResult = this._getResolver().resolve(contextValue, this._currentChord, e.asKeybinding());

		if (resolveResult && resolveResult.enterChord) {
			e.preventDefault();
			this._currentChord = resolveResult.enterChord;
			if (this._statusService) {
				let firstPartLabel = this.getLabelFor(new Keybinding(this._currentChord));
				this._currentChordStatusMessage = this._statusService.setStatusMessage(nls.localize('first.chord', "({0}) was pressed. Waiting for second key of chord...", firstPartLabel));
			}
			return;
		}

		if (this._statusService && this._currentChord) {
			if (!resolveResult || !resolveResult.commandId) {
				let firstPartLabel = this.getLabelFor(new Keybinding(this._currentChord));
				let chordPartLabel = this.getLabelFor(new Keybinding(e.asKeybinding()));
				this._statusService.setStatusMessage(nls.localize('missing.chord', "The key combination ({0}, {1}) is not a command.", firstPartLabel, chordPartLabel), 10 * 1000 /* 10s */);
				e.preventDefault();
			}
		}
		if (this._currentChordStatusMessage) {
			this._currentChordStatusMessage.dispose();
			this._currentChordStatusMessage = null;
		}
		this._currentChord = 0;

		if (resolveResult && resolveResult.commandId) {
			if (!/^\^/.test(resolveResult.commandId)) {
				e.preventDefault();
			}
			let commandId = resolveResult.commandId.replace(/^\^/, '');
			this._invokeHandler(commandId, [{}]).done(undefined, err => {
				this._messageService.show(Severity.Warning, err);
			});
		}
	}

	protected _invokeHandler(commandId: string, args: any[]): TPromise<any> {

		let handler = this._getCommandHandler(commandId);
		if (!handler) {
			return TPromise.wrapError(new Error(`No handler found for the command: '${commandId}'. An extension might be missing an activation event.`));
		}
		try {
			let result = this._instantiationService.invokeFunction.apply(this._instantiationService, [handler].concat(args));
			return TPromise.as(result);
		} catch (err) {
			return TPromise.wrapError(err);
		}
	}

	private _findContextAttr(domNode: HTMLElement): number {
		while (domNode) {
			if (domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
				return parseInt(domNode.getAttribute(KEYBINDING_CONTEXT_ATTR), 10);
			}
			domNode = domNode.parentElement;
		}
		return this._myContextId;
	}

	public getContext(contextId: number): KeybindingContext {
		return this._contexts[String(contextId)];
	}

	public createChildContext(parentContextId: number = this._myContextId): number {
		let id = (++this._lastContextId);
		this._contexts[String(id)] = new KeybindingContext(id, this.getContext(parentContextId));
		return id;
	}

	public disposeContext(contextId: number): void {
		delete this._contexts[String(contextId)];
	}

	public executeCommand(commandId: string, ...args: any[]): TPromise<any> {
		return this._invokeHandler(commandId, args);
	}
}

KeybindingsRegistry.registerCommandDesc({
	id: SET_CONTEXT_COMMAND_ID,
	handler: (accessor:ServicesAccessor, contextKey:any, contextValue:any) => {
		accessor.get(IKeybindingService).createKey(String(contextKey), contextValue);
	},
	weight: 0,
	primary: undefined,
	when: null
});

class ScopedKeybindingService extends AbstractKeybindingService {

	private _parent: AbstractKeybindingService;
	private _domNode: IKeybindingScopeLocation;

	constructor(parent: AbstractKeybindingService, domNode: IKeybindingScopeLocation) {
		super(parent.createChildContext());
		this._parent = parent;
		this._domNode = domNode;
		this._domNode.setAttribute(KEYBINDING_CONTEXT_ATTR, String(this._myContextId));
	}

	public dispose(): void {
		this._parent.disposeContext(this._myContextId);
		this._domNode.removeAttribute(KEYBINDING_CONTEXT_ATTR);
	}

	public getLabelFor(keybinding: Keybinding): string {
		return this._parent.getLabelFor(keybinding);
	}

	public getHTMLLabelFor(keybinding: Keybinding): IHTMLContentElement[] {
		return this._parent.getHTMLLabelFor(keybinding);
	}

	public getAriaLabelFor(keybinding: Keybinding): string {
		return this._parent.getAriaLabelFor(keybinding);
	}

	public getElectronAcceleratorFor(keybinding: Keybinding): string {
		return this._parent.getElectronAcceleratorFor(keybinding);
	}

	public getDefaultKeybindings(): string {
		return this._parent.getDefaultKeybindings();
	}

	public customKeybindingsCount(): number {
		return this._parent.customKeybindingsCount();
	}

	public lookupKeybindings(commandId: string): Keybinding[] {
		return this._parent.lookupKeybindings(commandId);
	}

	public getContext(contextId: number): KeybindingContext {
		return this._parent.getContext(contextId);
	}

	public createChildContext(parentContextId: number = this._myContextId): number {
		return this._parent.createChildContext(parentContextId);
	}

	public disposeContext(contextId: number): void {
		this._parent.disposeContext(contextId);
	}

	public executeCommand(commandId: string, args: any): TPromise<any> {
		return this._parent.executeCommand(commandId, args);
	}
}
