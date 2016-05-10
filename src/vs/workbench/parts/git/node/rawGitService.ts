/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import path = require('path');
import { TPromise, Promise } from 'vs/base/common/winjs.base';
import mime = require('vs/base/node/mime');
import pfs = require('vs/base/node/pfs');
import { Repository, GitError } from 'vs/workbench/parts/git/node/git.lib';
import { IRawGitService, RawServiceState, IRawStatus, IHead, GitErrorCodes, IPushOptions } from 'vs/workbench/parts/git/common/git';
import Event, { Emitter } from 'vs/base/common/event';

export class RawGitService implements IRawGitService {

	private repo: Repository;
	private _repositoryRoot: TPromise<string>;
	private _onOutput: Emitter<string>;
	get onOutput(): Event<string> { return this._onOutput.event; }

	constructor(repo: Repository) {
		this.repo = repo;

		let listener: () => void;

		this._onOutput = new Emitter<string>({
			onFirstListenerAdd: () => {
				listener = this.repo.onOutput(output => this._onOutput.fire(output));
			},
			onLastListenerRemove: () => {
				listener();
				listener = null;
			}
		});
	}

	getVersion(): TPromise<string> {
		return TPromise.as(this.repo.version);
	}

	private getRepositoryRoot(): TPromise<string> {
		return this._repositoryRoot || (this._repositoryRoot = pfs.realpath(this.repo.path));
	}

	serviceState(): TPromise<RawServiceState> {
		return TPromise.as<RawServiceState>(this.repo
			? RawServiceState.OK
			: RawServiceState.GitNotFound
		);
	}

	status(): TPromise<IRawStatus> {
		return this.repo.getStatus()
			.then(status => this.repo.getHEAD()
				.then(HEAD => {
					if (HEAD.name) {
						return this.repo.getBranch(HEAD.name).then(null, () => HEAD);
					} else {
						return HEAD;
					}
				}, (): IHead => null)
				.then(HEAD => Promise.join([this.getRepositoryRoot(), this.repo.getHeads(), this.repo.getTags(), this.repo.getRemotes()]).then(r => {
					return {
						repositoryRoot: r[0],
						status: status,
						HEAD: HEAD,
						heads: r[1],
						tags: r[2],
						remotes: r[3]
					};
				})))
			.then(null, (err) => {
				if (err.gitErrorCode === GitErrorCodes.BadConfigFile) {
					return Promise.wrapError(err);
				} else if (err.gitErrorCode === GitErrorCodes.NotAtRepositoryRoot) {
					return Promise.wrapError(err);
				}

				return null;
			});
	}

	init(): TPromise<IRawStatus> {
		return this.repo.init().then(() => this.status());
	}

	add(filePaths?: string[]): TPromise<IRawStatus> {
		return this.repo.add(filePaths).then(() => this.status());
	}

	stage(filePath: string, content: string): TPromise<IRawStatus> {
		return this.repo.stage(filePath, content).then(() => this.status());
	}

	branch(name: string, checkout?: boolean): TPromise<IRawStatus> {
		return this.repo.branch(name, checkout).then(() => this.status());
	}

	checkout(treeish?: string, filePaths?: string[]): TPromise<IRawStatus> {
		return this.repo.checkout(treeish, filePaths).then(() => this.status());
	}

	clean(filePaths: string[]): TPromise<IRawStatus> {
		return this.repo.clean(filePaths).then(() => this.status());
	}

	undo(): TPromise<IRawStatus> {
		return this.repo.undo().then(() => this.status());
	}

	reset(treeish: string, hard?: boolean): TPromise<IRawStatus> {
		return this.repo.reset(treeish, hard).then(() => this.status());
	}

	revertFiles(treeish: string, filePaths?: string[]): TPromise<IRawStatus> {
		return this.repo.revertFiles(treeish, filePaths).then(() => this.status());
	}

	fetch(): TPromise<IRawStatus> {
		return this.repo.fetch().then(null, (err) => {
			if (err.gitErrorCode === GitErrorCodes.NoRemoteRepositorySpecified) {
				return TPromise.as(null);
			}

			return Promise.wrapError(err);
		}).then(() => this.status());
	}

	pull(rebase?: boolean): TPromise<IRawStatus> {
		return this.repo.pull(rebase).then(() => this.status());
	}

	push(remote?: string, name?: string, options?:IPushOptions): TPromise<IRawStatus> {
		return this.repo.push(remote, name, options).then(() => this.status());
	}

	sync(): TPromise<IRawStatus> {
		return this.repo.sync().then(() => this.status());
	}

	commit(message:string, amend?: boolean, stage?: boolean): TPromise<IRawStatus> {
		let promise: Promise = TPromise.as(null);

		if (stage) {
			promise = this.repo.add(null);
		}

		return promise
			.then(() => this.repo.commit(message, stage, amend))
			.then(() => this.status());
	}

	detectMimetypes(filePath: string, treeish?: string): TPromise<string[]> {
		return pfs.exists(path.join(this.repo.path, filePath)).then((exists) => {
			if (exists) {
				return new TPromise<string[]>((c, e) => {
					mime.detectMimesFromFile(path.join(this.repo.path, filePath), (err, result) => {
						if (err) { e(err); }
						else { c(result.mimes); }
					});
				});
			}

			const child = this.repo.show(treeish + ':' + filePath);

			return new TPromise<string[]>((c, e) => {
				mime.detectMimesFromStream(child.stdout, filePath, (err, result) => {
					if (err) { e(err); }
					else { c(result.mimes); }
				});
			});
		});
	}

	// careful, this buffers the whole object into memory
	show(filePath: string, treeish?: string): TPromise<string> {
		treeish = (!treeish || treeish === '~') ? '' : treeish;
		return this.repo.buffer(treeish + ':' + filePath).then(null, e => {
			if (e instanceof GitError) {
				return ''; // mostly untracked files end up in a git error
			}

			return TPromise.wrapError<string>(e);
		});
	}
}
