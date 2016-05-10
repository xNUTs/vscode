/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import pfs = require('vs/base/node/pfs');
import URI from 'vs/base/common/uri';
import {TPromise} from 'vs/base/common/winjs.base';
import paths = require('vs/base/common/paths');
import {IExtensionService, IExtensionDescription} from 'vs/platform/extensions/common/extensions';
import {ExtensionsRegistry} from 'vs/platform/extensions/common/extensionsRegistry';
import {ExtHostAPIImplementation} from 'vs/workbench/api/node/extHost.api.impl';
import {IMainProcessExtHostIPC} from 'vs/platform/extensions/common/ipcRemoteCom';
import {ITelemetryService} from 'vs/platform/telemetry/common/telemetry';
import {IInstantiationService} from 'vs/platform/instantiation/common/instantiation';
import {InstantiationService} from 'vs/platform/instantiation/common/instantiationService';
import {ServiceCollection} from 'vs/platform/instantiation/common/serviceCollection';
import {ExtHostExtensionService} from 'vs/platform/extensions/common/nativeExtensionService';
import {IThreadService} from 'vs/platform/thread/common/thread';
import {ExtHostThreadService} from 'vs/platform/thread/common/extHostThreadService';
import {RemoteTelemetryService} from 'vs/platform/telemetry/common/remoteTelemetryService';
import {BaseWorkspaceContextService} from 'vs/platform/workspace/common/baseWorkspaceContextService';
import {ExtensionScanner, MessagesCollector} from 'vs/workbench/node/extensionPoints';
import {IWorkspaceContextService} from 'vs/platform/workspace/common/workspace';
import {Client} from 'vs/base/parts/ipc/node/ipc.net';
import {IExtensionManagementService} from 'vs/platform/extensionManagement/common/extensionManagement';
import {IExtensionManagementChannel, ExtensionManagementChannelClient} from 'vs/platform/extensionManagement/common/extensionManagementIpc';

const DIRNAME = URI.parse(require.toUrl('./')).fsPath;
const BASE_PATH = paths.normalize(paths.join(DIRNAME, '../../../..'));
const BUILTIN_EXTENSIONS_PATH = paths.join(BASE_PATH, 'extensions');

export interface IInitData {
	threadService: any;
	contextService: {
		workspace: any;
		configuration: any;
		options: any;
	};
}

const nativeExit = process.exit.bind(process);
process.exit = function() {
	const err = new Error('An extension called process.exit() and this was prevented.');
	console.warn((<any>err).stack);
};
export function exit(code?: number) {
	nativeExit(code);
}

export function createServices(remoteCom: IMainProcessExtHostIPC, initData: IInitData, sharedProcessClient: Client): IInstantiationService {

	let contextService = new BaseWorkspaceContextService(initData.contextService.workspace, initData.contextService.configuration, initData.contextService.options);
	let threadService = new ExtHostThreadService(remoteCom);
	threadService.setInstantiationService(new InstantiationService(new ServiceCollection([IThreadService, threadService])));
	let telemetryService = new RemoteTelemetryService('pluginHostTelemetry', threadService);

	let services = new ServiceCollection();
	services.set(IWorkspaceContextService, contextService);
	services.set(ITelemetryService, telemetryService);
	services.set(IThreadService, threadService);
	services.set(IExtensionService, new ExtHostExtensionService(threadService, telemetryService));

	// Connect to shared process services
	const channel = sharedProcessClient.getChannel<IExtensionManagementChannel>('extensions');
	const extensionsService = new ExtensionManagementChannelClient(channel);
	services.set(IExtensionManagementService, extensionsService);

	let instantiationService = new InstantiationService(services, true);
	threadService.setInstantiationService(instantiationService);

	// Create the ext host API
	instantiationService.createInstance(ExtHostAPIImplementation);

	return instantiationService;
}

interface ITestRunner {
	run(testsRoot: string, clb: (error: Error, failures?: number) => void): void;
}

export class ExtensionHostMain {

	private _isTerminating: boolean;
	private _contextService: IWorkspaceContextService;
	private _extensionService: ExtHostExtensionService;

	constructor(
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IExtensionService extensionService: IExtensionService
	) {
		this._isTerminating = false;
		this._contextService = contextService;
		this._extensionService = <ExtHostExtensionService>extensionService;
	}

	public start(): TPromise<void> {
		return this.readExtensions();
	}

	public terminate(): void {
		if (this._isTerminating) {
			// we are already shutting down...
			return;
		}
		this._isTerminating = true;

		try {
			let allExtensions = ExtensionsRegistry.getAllExtensionDescriptions();
			let allExtensionsIds = allExtensions.map(ext => ext.id);
			let activatedExtensions = allExtensionsIds.filter(id => this._extensionService.isActivated(id));

			activatedExtensions.forEach((extensionId) => {
				this._extensionService.deactivate(extensionId);
			});
		} catch (err) {
			// TODO: write to log once we have one
		}

		// Give extensions 1 second to wrap up any async dispose, then exit
		setTimeout(() => {
			exit();
		}, 1000);
	}

	private readExtensions(): TPromise<void> {
		let collector = new MessagesCollector();
		let env = this._contextService.getConfiguration().env;

		return ExtensionHostMain.scanExtensions(collector, BUILTIN_EXTENSIONS_PATH, !env.disableExtensions ? env.userExtensionsHome : void 0, !env.disableExtensions ? env.extensionDevelopmentPath : void 0, env.version)
			.then(null, err => {
				collector.error('', err);
				return [];
			})
			.then(extensions => {
				// Register & Signal done
				ExtensionsRegistry.registerExtensions(extensions);
				this._extensionService.registrationDone(collector.getMessages());
			})
			.then(() => this.handleEagerExtensions())
			.then(() => this.handleExtensionTests());
	}

	private static scanExtensions(collector: MessagesCollector, builtinExtensionsPath: string, userInstallPath: string, extensionDevelopmentPath: string, version: string): TPromise<IExtensionDescription[]> {
		const builtinExtensions = ExtensionScanner.scanExtensions(version, collector, builtinExtensionsPath, true);
		const userExtensions = !userInstallPath ? TPromise.as([]) : ExtensionScanner.scanExtensions(version, collector, userInstallPath, false);
		const developedExtensions = !extensionDevelopmentPath ? TPromise.as([]) : ExtensionScanner.scanOneOrMultipleExtensions(version, collector, extensionDevelopmentPath, false);

		return TPromise.join([builtinExtensions, userExtensions, developedExtensions]).then((_: IExtensionDescription[][]) => {
			let builtinExtensions = _[0];
			let userExtensions = _[1];
			let developedExtensions = _[2];

			let result: { [extensionId: string]: IExtensionDescription; } = {};
			builtinExtensions.forEach((builtinExtension) => {
				result[builtinExtension.id] = builtinExtension;
			});
			userExtensions.forEach((userExtension) => {
				if (result.hasOwnProperty(userExtension.id)) {
					collector.warn(userExtension.extensionFolderPath, nls.localize('overwritingExtension', "Overwriting extension {0} with {1}.", result[userExtension.id].extensionFolderPath, userExtension.extensionFolderPath));
				}
				result[userExtension.id] = userExtension;
			});
			developedExtensions.forEach(developedExtension => {
				collector.info('', nls.localize('extensionUnderDevelopment', "Loading development extension at {0}", developedExtension.extensionFolderPath));
				if (result.hasOwnProperty(developedExtension.id)) {
					collector.warn(developedExtension.extensionFolderPath, nls.localize('overwritingExtension', "Overwriting extension {0} with {1}.", result[developedExtension.id].extensionFolderPath, developedExtension.extensionFolderPath));
				}
				result[developedExtension.id] = developedExtension;
			});

			return Object.keys(result).map(name => result[name]);
		});
	}

	// Handle "eager" activation extensions
	private handleEagerExtensions(): TPromise<void> {
		this._extensionService.activateByEvent('*').then(null, (err) => {
			console.error(err);
		});
		return this.handleWorkspaceContainsEagerExtensions();
	}

	private handleWorkspaceContainsEagerExtensions(): TPromise<void> {
		let workspace = this._contextService.getWorkspace();
		if (!workspace || !workspace.resource) {
			return TPromise.as(null);
		}

		let folderPath = workspace.resource.fsPath;

		let desiredFilesMap: {
			[filename: string]: boolean;
		} = {};

		ExtensionsRegistry.getAllExtensionDescriptions().forEach((desc) => {
			let activationEvents = desc.activationEvents;
			if (!activationEvents) {
				return;
			}

			for (let i = 0; i < activationEvents.length; i++) {
				if (/^workspaceContains:/.test(activationEvents[i])) {
					let fileName = activationEvents[i].substr('workspaceContains:'.length);
					desiredFilesMap[fileName] = true;
				}
			}
		});

		return TPromise.join(
			Object.keys(desiredFilesMap).map(
				(fileName) => pfs.fileExistsWithResult(paths.join(folderPath, fileName), fileName)
			)
		).then((fileNames: string[]) => {
			fileNames.forEach((existingFileName) => {
				if (!existingFileName) {
					return;
				}

				let activationEvent = 'workspaceContains:' + existingFileName;
				this._extensionService.activateByEvent(activationEvent).then(null, (err) => {
					console.error(err);
				});
			});
		});
	}

	private handleExtensionTests(): TPromise<void> {
		let env = this._contextService.getConfiguration().env;
		if (!env.extensionTestsPath || !env.extensionDevelopmentPath) {
			return TPromise.as(null);
		}

		// Require the test runner via node require from the provided path
		let testRunner: ITestRunner;
		let requireError: Error;
		try {
			testRunner = <any>require.__$__nodeRequire(env.extensionTestsPath);
		} catch (error) {
			requireError = error;
		}

		// Execute the runner if it follows our spec
		if (testRunner && typeof testRunner.run === 'function') {
			return new TPromise<void>((c, e) => {
				testRunner.run(env.extensionTestsPath, (error, failures) => {
					if (error) {
						e(error.toString());
					} else {
						c(null);
					}

					// after tests have run, we shutdown the host
					this.gracefulExit(failures && failures > 0 ? 1 /* ERROR */ : 0 /* OK */);
				});
			});
		}

		// Otherwise make sure to shutdown anyway even in case of an error
		else {
			this.gracefulExit(1 /* ERROR */);
		}

		return TPromise.wrapError<void>(requireError ? requireError.toString() : nls.localize('extensionTestError', "Path {0} does not point to a valid extension test runner.", env.extensionTestsPath));
	}

	private gracefulExit(code: number): void {
		// to give the PH process a chance to flush any outstanding console
		// messages to the main process, we delay the exit() by some time
		setTimeout(() => exit(code), 500);
	}
}