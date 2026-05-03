# Transcript Smoke Checklist

## Analyze

- Open `analyze` and verify the microphone button appears beside `#compose-input`.
- Start dictation and confirm the button switches to listening state.
- Stop dictation and confirm the transcript is inserted into `#compose-input`.
- Verify the send button state updates after transcript insertion.
- Verify existing typed draft text is preserved when transcript text is inserted.

## Native OpenCode UI

- Open `assistant` with native OpenCode UI and verify the microphone button appears in the `#chat-input` row.
- Start dictation and confirm the button switches to listening state.
- Stop dictation and confirm the transcript is inserted into `#chat-input`.
- Verify the textarea still auto-resizes after transcript insertion.
- Verify the send button still reflects whether message text exists.

## Ingress seam

- Submit a synthetic transcript envelope with `target: "analyze-compose"` and confirm it reaches `#compose-input`.
- Submit a synthetic transcript envelope with `target: "assistant-opencode-native"` and confirm it reaches the native OpenCode UI input.
- Reload the assistant webview and confirm queued transcript ingress is replayed after `dom-ready`.

## Non-regression

- Open the existing `whisper` page/tool and confirm it still behaves as the scheduled-message feature.
- Verify analyze file upload still works.
- Verify analyze send still works without using the microphone button.
- Verify native OpenCode UI send still works without using the microphone button.
