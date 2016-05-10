/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import Event from 'vs/base/common/event';
import {IDisposable} from 'vs/base/common/lifecycle';
import {TPromise} from 'vs/base/common/winjs.base';
import {ServiceIdentifier} from 'vs/platform/instantiation/common/instantiation';
import * as modes from 'vs/editor/common/modes';
import {ILanguage} from 'vs/editor/common/modes/monarch/monarchTypes';
import {IRichEditConfiguration} from 'vs/editor/common/modes/supports/richEditSupport';
import {IEditorWorkerService} from 'vs/editor/common/services/editorWorkerService';
import {IModelService} from 'vs/editor/common/services/modelService';
import {IModeService, IModeLookupResult} from 'vs/editor/common/services/modeService';

export class MockModeService implements IModeService {
	serviceId: ServiceIdentifier<any> = IModeService;

	onDidAddModes: Event<string[]> = undefined;
	onDidCreateMode: Event<modes.IMode> = undefined;

	configureMode(modeName: string, options: any): void {
		throw new Error('Not implemented');
	}
	configureModeById(modeId: string, options: any): void {
		throw new Error('Not implemented');
	}
	configureAllModes(config:any): void {
		throw new Error('Not implemented');
	}
	getConfigurationForMode(modeId:string): any {
		throw new Error('Not implemented');
	}

	// --- reading
	isRegisteredMode(mimetypeOrModeId: string): boolean {
		throw new Error('Not implemented');
	}
	isCompatMode(modeId: string): boolean {
		throw new Error('Not implemented');
	}
	getRegisteredModes(): string[] {
		throw new Error('Not implemented');
	}
	getRegisteredLanguageNames(): string[] {
		throw new Error('Not implemented');
	}
	getExtensions(alias: string): string[] {
		throw new Error('Not implemented');
	}
	getMimeForMode(modeId: string): string {
		throw new Error('Not implemented');
	}
	getLanguageName(modeId:string): string {
		throw new Error('Not implemented');
	}
	getModeIdForLanguageName(alias:string): string {
		throw new Error('Not implemented');
	}
	getModeId(commaSeparatedMimetypesOrCommaSeparatedIds: string): string {
		throw new Error('Not implemented');
	}
	getConfigurationFiles(modeId: string): string[] {
		throw new Error('Not implemented');
	}

	// --- instantiation
	lookup(commaSeparatedMimetypesOrCommaSeparatedIds: string): IModeLookupResult[] {
		throw new Error('Not implemented');
	}
	getMode(commaSeparatedMimetypesOrCommaSeparatedIds: string): modes.IMode {
		throw new Error('Not implemented');
	}
	getOrCreateMode(commaSeparatedMimetypesOrCommaSeparatedIds: string): TPromise<modes.IMode> {
		throw new Error('Not implemented');
	}
	getOrCreateModeByLanguageName(languageName: string): TPromise<modes.IMode> {
		throw new Error('Not implemented');
	}
	getOrCreateModeByFilenameOrFirstLine(filename: string, firstLine?:string): TPromise<modes.IMode> {
		throw new Error('Not implemented');
	}

	registerRichEditSupport(modeId: string, support: IRichEditConfiguration): IDisposable {
		throw new Error('Not implemented');
	}
	registerTokenizationSupport(modeId: string, callback: (mode: modes.IMode) => modes.ITokenizationSupport): IDisposable {
		throw new Error('Not implemented');
	}
	registerMonarchDefinition(modelService: IModelService, editorWorkerService: IEditorWorkerService, modeId:string, language:ILanguage): IDisposable {
		throw new Error('Not implemented');
	}
}
