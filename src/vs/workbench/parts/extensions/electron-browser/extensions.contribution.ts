/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/extensions';
import { Registry } from 'vs/platform/platform';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IStatusbarRegistry, Extensions as StatusbarExtensions, StatusbarItemDescriptor, StatusbarAlignment } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { ExtensionsStatusbarItem } from 'vs/workbench/parts/extensions/electron-browser/extensionsWidgets';
import { IExtensionGalleryService, IExtensionTipsService, ExtensionsLabel, ExtensionsChannelId } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionGalleryService } from 'vs/platform/extensionManagement/node/extensionGalleryService';
import { ExtensionTipsService } from 'vs/workbench/parts/extensions/electron-browser/extensionTipsService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { ExtensionsWorkbenchExtension } from 'vs/workbench/parts/extensions/electron-browser/extensionsWorkbenchExtension';
import { IOutputChannelRegistry, Extensions as OutputExtensions } from 'vs/workbench/parts/output/common/output';

registerSingleton(IExtensionGalleryService, ExtensionGalleryService);
registerSingleton(IExtensionTipsService, ExtensionTipsService);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ExtensionsWorkbenchExtension);

Registry.as<IStatusbarRegistry>(StatusbarExtensions.Statusbar)
	.registerStatusbarItem(new StatusbarItemDescriptor(ExtensionsStatusbarItem, StatusbarAlignment.LEFT,10000));

Registry.as<IOutputChannelRegistry>(OutputExtensions.OutputChannels)
	.registerChannel(ExtensionsChannelId, ExtensionsLabel);