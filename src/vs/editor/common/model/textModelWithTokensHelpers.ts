/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {IPosition, IWordAtPosition} from 'vs/editor/common/editorCommon';
import {IMode, IModeTransition} from 'vs/editor/common/modes';
import {NullMode} from 'vs/editor/common/modes/nullMode';
import {ModeTransition} from 'vs/editor/common/core/modeTransition';

export interface ITextSource {

	_lineIsTokenized(lineNumber:number): boolean;

	getLineContent(lineNumber:number): string;

	getMode(): IMode;

	_getLineModeTransitions(lineNumber:number): ModeTransition[];
}

export interface INonWordTokenMap {
	[key:string]:boolean;
}

export class WordHelper {

	private static _safeGetWordDefinition(mode:IMode): RegExp {
		return (mode.richEditSupport ? mode.richEditSupport.wordDefinition : null);
	}

	public static ensureValidWordDefinition(wordDefinition?:RegExp): RegExp {
		var result: RegExp = NullMode.DEFAULT_WORD_REGEXP;

		if (wordDefinition && (wordDefinition instanceof RegExp)) {
			if (!wordDefinition.global) {
				var flags = 'g';
				if (wordDefinition.ignoreCase) {
					flags += 'i';
				}
				if (wordDefinition.multiline) {
					flags += 'm';
				}
				result = new RegExp(wordDefinition.source, flags);
			} else {
				result = wordDefinition;
			}
		}

		result.lastIndex = 0;

		return result;
	}

	public static massageWordDefinitionOf(mode:IMode): RegExp {
		return WordHelper.ensureValidWordDefinition(WordHelper._safeGetWordDefinition(mode));
	}

	private static _getWordAtColumn(txt:string, column:number, modeIndex: number, modeTransitions:IModeTransition[]): IWordAtPosition {
		var modeStartIndex = modeTransitions[modeIndex].startIndex,
			modeEndIndex = (modeIndex + 1 < modeTransitions.length ? modeTransitions[modeIndex + 1].startIndex : txt.length),
			mode = modeTransitions[modeIndex].mode;

		return WordHelper._getWordAtText(
			column, WordHelper.massageWordDefinitionOf(mode),
			txt.substring(modeStartIndex, modeEndIndex), modeStartIndex
		);
	}

	public static getWordAtPosition(textSource:ITextSource, position:IPosition): IWordAtPosition {

		if (!textSource._lineIsTokenized(position.lineNumber)) {
			return WordHelper._getWordAtText(position.column, WordHelper.massageWordDefinitionOf(textSource.getMode()), textSource.getLineContent(position.lineNumber), 0);
		}

		var result: IWordAtPosition = null;
		var txt = textSource.getLineContent(position.lineNumber),
			modeTransitions = textSource._getLineModeTransitions(position.lineNumber),
			columnIndex = position.column - 1,
			modeIndex = ModeTransition.findIndexInSegmentsArray(modeTransitions, columnIndex);

		result = WordHelper._getWordAtColumn(txt, position.column, modeIndex, modeTransitions);

		if (!result && modeIndex > 0 && modeTransitions[modeIndex].startIndex === columnIndex) {
			// The position is right at the beginning of `modeIndex`, so try looking at `modeIndex` - 1 too
			result = WordHelper._getWordAtColumn(txt, position.column, modeIndex - 1, modeTransitions);
		}

		return result;
	}

	static _getWordAtText(column:number, wordDefinition:RegExp, text:string, textOffset:number): IWordAtPosition {

		// console.log('_getWordAtText: ', column, text, textOffset);

		var words = text.match(wordDefinition),
			k:number,
			startWord:number,
			endWord:number,
			startColumn:number,
			endColumn:number,
			word:string;

		if (words) {
			for (k = 0; k < words.length; k++) {
				word = words[k].trim();
				if (word.length > 0) {
					startWord = text.indexOf(word, endWord);
					endWord = startWord + word.length;

					startColumn = textOffset + startWord + 1;
					endColumn = textOffset + endWord + 1;

					if (startColumn <= column && column <= endColumn) {
						return {
							word: word,
							startColumn: startColumn,
							endColumn: endColumn
						};
					}
				}
			}
		}

		return null;
	}
}
