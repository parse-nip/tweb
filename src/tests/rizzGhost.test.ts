import '@/tests/mocks/chatInputEditorNodes';
import {TextSelection} from '@tiptap/pm/state';
import {mountChatInputEditor} from '@/tests/helpers/chatInputEditor';

describe('rizz ghost text', () => {
  test('is drawn after the caret, never becomes content, and Tab types it in', () => {
    const {editor, input, tiptap} = mountChatInputEditor();
    try {
      editor.setTextWithEntities('hey bbg');
      tiptap.view.dispatch(tiptap.state.tr.setSelection(TextSelection.create(tiptap.state.doc, 8)));
      editor.setRizzGhost(' wanna hear my bedroom mix?');

      const ghost = input.querySelector('.chat-input-rizz-ghost');
      expect(ghost?.textContent).toBe(' wanna hear my bedroom mix?');
      expect(editor.getRichValue().value).toBe('hey bbg');

      const handled = tiptap.view.someProp('handleKeyDown', (handler) => handler(tiptap.view, new KeyboardEvent('keydown', {key: 'Tab'})));
      expect(handled).toBe(true);
      expect(editor.getRichValue().value).toBe('hey bbg wanna hear my bedroom mix?');
      expect(input.querySelector('.chat-input-rizz-ghost')).toBeNull();
    } finally {
      editor.destroy();
      input.remove();
    }
  });

  test('goes at once when the user types or moves the caret, and is not offered mid-text', () => {
    const {editor, input, tiptap} = mountChatInputEditor();
    try {
      editor.setTextWithEntities('hello');
      tiptap.view.dispatch(tiptap.state.tr.setSelection(TextSelection.create(tiptap.state.doc, 6)));
      editor.setRizzGhost(' there');
      tiptap.view.dispatch(tiptap.state.tr.insertText('!'));
      expect(editor.getRizzGhost()).toBe('');
      expect(input.querySelector('.chat-input-rizz-ghost')).toBeNull();

      editor.setRizzGhost(' there');
      tiptap.view.dispatch(tiptap.state.tr.setSelection(TextSelection.create(tiptap.state.doc, 2)));
      expect(input.querySelector('.chat-input-rizz-ghost')).toBeNull();
    } finally {
      editor.destroy();
      input.remove();
    }
  });
});
