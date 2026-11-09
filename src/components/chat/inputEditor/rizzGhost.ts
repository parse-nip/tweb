import type {Editor} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {isTrailingPlaceholderNode} from '@components/chat/inputEditor/model';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

/*
 * Ghost text: a suggestion drawn grey after the caret (Rizz Coach, `components/rizz/ghostText`). It is a widget
 * decoration, so it is no part of the document: it is never sent, copied or counted. Tab (or ArrowRight at the end, as in a search box) takes it in as typed text;
 * typing anything else, or leaving the end of the text, drops it. The plugin is installed on first use only.
 */

export const RIZZ_GHOST_CLASS = 'chat-input-rizz-ghost';

const rizzGhostKey = new PluginKey<string>('rizzGhost');

export function getRizzGhost(editor: Editor): string {
  return rizzGhostKey.getState(editor.state) || '';
}

export default function setRizzGhost(editor: Editor, suggestion?: string) {
  if(editor.isDestroyed) return;
  const current = rizzGhostKey.getState(editor.state);
  if(!suggestion && !current) return;

  if(current === undefined) {
    editor.registerPlugin(new Plugin<string>({
      key: rizzGhostKey,
      state: {
        init: () => '',
        apply: (transaction, value) => {
          const meta = transaction.getMeta(rizzGhostKey) as string | undefined;
          if(meta !== undefined) return meta;
          // any edit or caret move is the user's: the suggestion was for the text as it was
          return transaction.docChanged || transaction.selectionSet ? '' : value;
        }
      },
      props: {
        decorations: (state) => {
          const suggestion = rizzGhostKey.getState(state);
          if(!suggestion) return null;

          const {selection, doc} = state;
          const {$to} = selection;
          // only at the very end of the text: a suggestion in the middle of a line would be a lie about what Tab does
          // the technical empty paragraph after the text is not where the text ends
          const last = doc.childCount > 1 && isTrailingPlaceholderNode(doc.lastChild) ? doc.child(doc.childCount - 2) : doc.lastChild;
          if(!selection.empty || $to.parent !== last || $to.parentOffset !== $to.parent.content.size) return null;

          return DecorationSet.create(doc, [Decoration.widget(selection.to, () => {
            const element = document.createElement('span');
            element.className = RIZZ_GHOST_CLASS;
            element.textContent = suggestion;
            element.setAttribute('aria-hidden', 'true');
            element.contentEditable = 'false';
            return element;
          }, {side: 1, key: 'rizz-ghost:' + suggestion, ignoreSelection: true})]);
        },
        handleKeyDown: (view, event) => {
          const suggestion = rizzGhostKey.getState(view.state);
          if(!suggestion) return false;

          if((event.key === 'Tab' || event.key === 'ArrowRight') && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            view.dispatch(view.state.tr.setMeta(rizzGhostKey, '').insertText(suggestion));
            return true;
          }

          if(event.key === 'Escape') {
            view.dispatch(view.state.tr.setMeta(rizzGhostKey, ''));
          }

          return false;
        }
      }
    }));
  }

  editor.view.dispatch(editor.state.tr.setMeta(rizzGhostKey, suggestion || ''));
}
