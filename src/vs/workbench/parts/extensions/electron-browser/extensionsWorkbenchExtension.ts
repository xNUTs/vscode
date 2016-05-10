/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import errors = require('vs/base/common/errors');
import platform = require('vs/platform/platform');
import { Promise } from 'vs/base/common/winjs.base';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IExtensionManagementService, IExtensionGalleryService, IExtensionTipsService, ExtensionsLabel } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService } from 'vs/platform/message/common/message';
import Severity from 'vs/base/common/severity';
import { IWorkspaceContextService } from 'vs/workbench/services/workspace/common/contextService';
import { ReloadWindowAction } from 'vs/workbench/electron-browser/actions';
import wbaregistry = require('vs/workbench/common/actionRegistry');
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ListExtensionsAction, InstallExtensionAction, ListOutdatedExtensionsAction, ListSuggestedExtensionsAction } from './extensionsActions';
import { IQuickOpenRegistry, Extensions, QuickOpenHandlerDescriptor } from 'vs/workbench/browser/quickopen';
import {ipcRenderer as ipc} from 'electron';

interface IInstallExtensionsRequest {
	extensionsToInstall: string[];
}

export class ExtensionsWorkbenchExtension implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IExtensionManagementService private extensionManagementService: IExtensionManagementService,
		@IMessageService private messageService: IMessageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IExtensionTipsService extenstionTips: IExtensionTipsService, // this is to eagerly start the service
		@IExtensionGalleryService galleryService: IExtensionGalleryService
	) {
		this.registerListeners();

		const options = contextService.getOptions();
		// Extensions to install
		if (options.extensionsToInstall && options.extensionsToInstall.length) {
			this.install(options.extensionsToInstall).done(null, errors.onUnexpectedError);
		}

		const actionRegistry = (<wbaregistry.IWorkbenchActionRegistry> platform.Registry.as(wbaregistry.Extensions.WorkbenchActions));
		actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(ListExtensionsAction, ListExtensionsAction.ID, ListExtensionsAction.LABEL), 'Extensions: Show Installed Extensions', ExtensionsLabel);

		(<IQuickOpenRegistry>platform.Registry.as(Extensions.Quickopen)).registerQuickOpenHandler(
			new QuickOpenHandlerDescriptor(
				'vs/workbench/parts/extensions/electron-browser/extensionsQuickOpen',
				'LocalExtensionsHandler',
				'ext ',
				nls.localize('localExtensionsCommands', "Show Local Extensions")
			)
		);

		if (galleryService.isEnabled()) {

			actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(InstallExtensionAction, InstallExtensionAction.ID, InstallExtensionAction.LABEL), 'Extensions: Install Extension', ExtensionsLabel);

			(<IQuickOpenRegistry>platform.Registry.as(Extensions.Quickopen)).registerQuickOpenHandler(
				new QuickOpenHandlerDescriptor(
					'vs/workbench/parts/extensions/electron-browser/extensionsQuickOpen',
					'GalleryExtensionsHandler',
					'ext install ',
					nls.localize('galleryExtensionsCommands', "Install Gallery Extensions"),
					true
				)
			);

			actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(ListOutdatedExtensionsAction, ListOutdatedExtensionsAction.ID, ListOutdatedExtensionsAction.LABEL), 'Extensions: Show Outdated Extensions', ExtensionsLabel);

			(<IQuickOpenRegistry>platform.Registry.as(Extensions.Quickopen)).registerQuickOpenHandler(
				new QuickOpenHandlerDescriptor(
					'vs/workbench/parts/extensions/electron-browser/extensionsQuickOpen',
					'OutdatedExtensionsHandler',
					'ext update ',
					nls.localize('outdatedExtensionsCommands', "Update Outdated Extensions")
				)
			);

			// add extension tips services
			actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(ListSuggestedExtensionsAction, ListSuggestedExtensionsAction.ID, ListSuggestedExtensionsAction.LABEL), 'Extensions: Show Extension Recommendations', ExtensionsLabel);

			(<IQuickOpenRegistry>platform.Registry.as(Extensions.Quickopen)).registerQuickOpenHandler(
				new QuickOpenHandlerDescriptor(
					'vs/workbench/parts/extensions/electron-browser/extensionsQuickOpen',
					'SuggestedExtensionHandler',
					'ext recommend ',
					nls.localize('suggestedExtensionsCommands', "Show Extension Recommendations")
				)
			);
		}
	}

	private registerListeners(): void {
		ipc.on('vscode:installExtensions', (event, request: IInstallExtensionsRequest) => {
			if (request.extensionsToInstall) {
				this.install(request.extensionsToInstall).done(null, errors.onUnexpectedError);
			}
		});
	}

	private install(extensions: string[]): Promise {
		return Promise.join(extensions.map(extPath =>	this.extensionManagementService.install(extPath)))
			.then(extensions => {
				this.messageService.show(
					Severity.Info,
					{
						message: extensions.length > 1 ? nls.localize('success', "Extensions were successfully installed. Restart to enable them.")
							: nls.localize('successSingle', "{0} was successfully installed. Restart to enable it.", extensions[0].displayName),
						actions: [this.instantiationService.createInstance(ReloadWindowAction, ReloadWindowAction.ID, nls.localize('reloadNow', "Restart Now"))]
					}
				);
			});
	}

	public getId(): string {
		return 'vs.extensions.workbenchextension';
	}
}
