/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import nls = require('vs/nls');
import { TPromise } from 'vs/base/common/winjs.base';
import Event from 'vs/base/common/event';
import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';

export interface IExtensionManifest {
	name: string;
	publisher: string;
	version: string;
	engines: { vscode: string };
	displayName?: string;
	description?: string;
	main?: string;
}

export interface IGalleryVersion {
	version: string;
	date: string;
	manifestUrl: string;
	downloadUrl: string;
	downloadHeaders: { [key: string]: string; };
}

export interface IGalleryMetadata {
	galleryApiUrl: string;
	id: string;
	publisherId: string;
	publisherDisplayName: string;
	installCount: number;
	versions: IGalleryVersion[];
}

export interface IExtension extends IExtensionManifest {
	galleryInformation?: IGalleryMetadata;
	path?: string;
}

export const IExtensionManagementService = createDecorator<IExtensionManagementService>('extensionManagementService');
export const IExtensionGalleryService = createDecorator<IExtensionGalleryService>('extensionGalleryService');

export interface IQueryOptions {
	text?: string;
	ids?: string[];
	pageSize?: number;
}

export interface IQueryResult {
	firstPage: IExtension[];
	total: number;
	pageSize: number;
	getPage(pageNumber: number): TPromise<IExtension[]>;
}

export interface IExtensionGalleryService {
	serviceId: ServiceIdentifier<any>;
	isEnabled(): boolean;
	query(options?: IQueryOptions): TPromise<IQueryResult>;
}

export interface IExtensionManagementService {
	serviceId: ServiceIdentifier<any>;
	onInstallExtension: Event<IExtensionManifest>;
	onDidInstallExtension: Event<{ extension: IExtension; error?: Error; }>;
	onUninstallExtension: Event<IExtension>;
	onDidUninstallExtension: Event<IExtension>;

	install(extension: IExtension): TPromise<IExtension>;
	install(zipPath: string): TPromise<IExtension>;
	uninstall(extension: IExtension): TPromise<void>;
	getInstalled(includeDuplicateVersions?: boolean): TPromise<IExtension[]>;
}

export const IExtensionTipsService = createDecorator<IExtensionTipsService>('extensionTipsService');

export interface IExtensionTipsService {
	serviceId: ServiceIdentifier<IExtensionTipsService>;
	getRecommendations(): TPromise<IExtension[]>;
}

export const ExtensionsLabel = nls.localize('extensions', "Extensions");
export const ExtensionsChannelId = 'extensions';