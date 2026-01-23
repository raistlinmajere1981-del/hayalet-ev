# 🎨 HAYALET-EV FIGMA COMPONENT LİSTESİ

## Objelerin Konumları ve İsimleri

---

## 1. GLOBAL LAYOUT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOP-BAR                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            MAIN-CONTENT                                     │
│                         (pages-container)                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                              SIDE-NAV-OVERLAY│
│                                                                          ═══│
└─────────────────────────────────────────────────────────────────────────────┘
```

### SLOT-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `slot-card` | div |
| Header | `slot-header` | div |
| Row | `slot-header-top` | div |
| Wrapper | `slot-avatar-wrapper` | div |
| Image | `{slot}-avatar` | div |
| Dot | `{slot}-status-dot` | span |
| Container | `slot-info` | div |
| Text | `{slot}-nickname` | span |
| Select | `{slot}-account-select` | select |
| Container | `slot-actions` | div |
| Button | `{slot}-toggle-btn` | button |
| Button | `{slot}-devtools-btn` | button |
| Row | `slot-settings-row` | div |
| Grid | `slot-methods-grid` | div |
| Group | `setting-group` | div |
| Label | `setting-label` | label |
| Select | `{slot}-msg-method` | select |
| Select | `{slot}-file-method` | select |
| Label | `catch-label` | label |
| Checkbox | `{slot}-catch-check` | input |
| Bar | `slot-url-bar` | div |
| Text | `{slot}-url-display` | div |
| Container | `slot-webview-container` | div |
| Overlay | `{slot}-webview-overlay` | div |
| Icon | `overlay-icon` | div |
| Text | `overlay-title` | div |
| Text | `overlay-subtitle` | div |

### CONTROL-PANEL-ACCORDION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `control-panel-accordion` | div |
| Button | `settings-accordion-toggle` | button |
| Icon | `accordion-icon` | span (⚙️) |
| Text | `accordion-title` | span |
| Container | `accordion-badges` | span |
| Badge | `account-count` | span |
| Badge | `whisper-count` | span |
| Icon | `accordion-chevron` | span (▼) |
| Content | `settings-accordion-content` | div |
| Grid | `accordion-panels` | div |

### PANEL: USER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="user" |
| Icon | `panel-icon` | span (👤) |
| Title | `panel-title` | span |
| Wrapper | `user-avatar-wrapper` | div |
| Image | `user-avatar` | div |
| Overlay | `user-edit-overlay` | div (📷) |
| Input | `user-nickname-input` | input |
| Container | `gdrive-settings` | div |
| Status | `connection-status` | div |
| Dot | `gdrive-status-dot` | span |
| Text | `gdrive-status-text` | span |
| Input | `gdrive-client-id` | input |
| Input | `gdrive-client-secret` | input |
| Input | `gdrive-auth-code` | input |
| Button | `gdrive-start-auth` | button |
| Button | `gdrive-connect-btn` | button |

### PANEL: ACCOUNTS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="accounts" |
| Icon | `panel-icon` | span (📋) |
| Title | `panel-title` | span |
| List | `account-list` | div |
| Form | `account-form` | div |
| Text | `account-status-msg` | span |
| Input | `new-account-email` | input |
| Input | `new-account-nickname` | input |
| Select | `new-account-provider` | select |
| Preview | `new-account-avatar-preview` | div |
| Button | `new-account-avatar-browse` | button |
| Button | `settings-create-account` | button |
| Button | `settings-cancel-edit` | button |

### PANEL: WHISPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="whisper" |
| Icon | `panel-icon` | span (🎤) |
| Title | `panel-title` | span |
| Button | `whisper-clear-btn` | button |
| List | `whisper-pending-list` | div |

### PANEL: REPORT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="report" |
| Icon | `panel-icon` | span (📊) |
| Title | `panel-title` | span |
| Button | `report-modal-open` | button (⛶) |
| Content | `entrance-report-content` | div |

---

## 5. PAGE: ANALYZE (Analiz Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ANALYZE                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CONVERSATION-GRID                                                       │ │
│ │ ┌────────────────────────────────┬────────────────────────────────────┐ │ │
│ │ │        CONV-CARD (AI1)         │         CONV-CARD (AI2)            │ │ │
│ │ └────────────────────────────────┴────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMPOSE-ROW                                                             │ │
│ │ ┌─────────────┬───────────────────────────────────┬───────────────────┐ │ │
│ │ │COMPOSE-SIDE  │         COMPOSE-AREA              │   COMPOSE-FILES   │ │ │
│ │ └─────────────┴───────────────────────────────────┴───────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CONV-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `conv-card` | div |
| Header | `conv-header` | div |
| Container | `identity` | div |
| Avatar | `avatar-{slot}` | div |
| Text | `name-{slot}` | div |
| Text | `status-{slot}` | div |
| Container | `header-actions` | div |
| Select | `filter-count-{slot}` | select |
| Body | `messages-{slot}` | div |
| Placeholder | `message-placeholder` | div |

### COMPOSE-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-sidebar` | div |
| Button | `compose-start-btn` | button (📝 Analiz Sohbeti) |
| Group | `ai-chat-group` | div |
| Container | `relay-controls` | div |
| Radio | `relay-starter` | input, value="ai1" |
| Label | `relay-ai1-label` | span |
| Radio | `relay-starter` | input, value="ai2" |
| Label | `relay-ai2-label` | span |
| Button | `ai-chat-start` | button (🔄 AI-AI Sohbeti) |

### COMPOSE-AREA
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-area` | div |
| Textarea | `compose-input` | textarea |
| Container | `compose-actions` | div |
| Container | `send-controls` | div |
| Checkbox | `send-ai1` | input |
| Label | `send-ai1-label` | span |
| Checkbox | `send-ai2` | input |
| Label | `send-ai2-label` | span |
| Checkbox | `send-cross` | input |
| Label | "Çaprazla" | span |
| Button | `compose-send-btn` | button |

### COMPOSE-FILES
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-files` | div |
| Box | `upload-list` | div |
| Header | `files-header` | div |
| Button | `upload-add-btn` | button |

### READ-MODAL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `read-modal` | div |
| Content | `read-modal-content` | div |
| Header | `read-modal-header` | div |
| Button | `read-modal-close` | button |
| Body | `read-modal-body` | div |

---

## 6. PAGE: ASISTAN (Asistan Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ASISTAN                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-TOPBAR                                                          │ │
│ │ ┌───────────────────────────────────┬─────────────────────────────┐ │ │
│ │ │         CONTROLS-LEFT                 │      CONTROLS-RIGHT         │ │ │
│ │ └───────────────────────────────────┴─────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-NATIVE-PANEL (veya ASISTAN-WEBVIEW-PANEL)                       │ │
│ │                   ┌──────────────────────────┐                              │ │
│ │                   │     PLACEHOLDER          │                              │ │
│ │                   │     🤖 Native UI         │                              │ │
│ │                   │  Bağlan butonuna tıklayın│                              │ │
│ │                   └──────────────────────────┘                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ASISTAN-TOPBAR / CONTROLS-LEFT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-left` | div |
| Group | `control-group` | div |
| Label | "Provider" | label |
| Select | `asistan-provider-select` | select |
| Button | `asistan-connect-btn` | button |
| Container | `asistan-status` | div |
| Dot | `asistan-status-dot` | span |
| Text | `asistan-status-text` | span |
| Button | `asistan-devtools-btn` | button |
| Group | `ui-mode-toggle` | div |
| Label | "UI Modu" | label |
| Container | `toggle-buttons` | div |
| Button | `ui-mode-native` | button |
| Button | `ui-mode-webview` | button |

### ASISTAN-TOPBAR / CONTROLS-RIGHT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-right` | div |
| Button | `ai-asistan-relay-btn` | button |
| Label | "Kaynak" | label |
| Select | `ai-asistan-source` | select |

### ASISTAN-NATIVE-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-native-panel` | div |
| Placeholder | `native-placeholder` | div |
| Icon | placeholder-icon | span (🤖) |
| Text | placeholder-title | div |
| Text | placeholder-subtitle | div |

### ASISTAN-WEBVIEW-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-webview-panel` | div |
| Webview | `asistan-webview` | webview |

---

## 7. PAGE: SERVER (Sunucu Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-SERVER                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SERVER-TOPBAR                                                           │ │
│ │ Kontrol AI: [SELECT] [Devret] [Devral]                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────┬───────────────────────────────────────────────┐ │
│ │   LOG-PANEL-INCOMING   │              LOG-PANEL-OUTGOING               │ │
│ │   AI → CoreEngine      │              CoreEngine → AI                  │ │
│ └────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMMAND-TEST-SECTION                                                    │ │
│ │ ┌───────────────────────┬──────────────────────────────────────────────┐ │ │
│ │ │   COMMAND-INPUT       │               COMMAND-HELPER                  │ │ │
│ │ │ [textarea]            │ Komut Ekle: [SELECT][+]                       │ │ │
│ │ │ [CoreEngine'e Gönder] │ Kullanım Kılavuzu: [textarea]                 │ │ │
│ │ └───────────────────────┴──────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SERVER-TOPBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `server-topbar` | div |
| Label | "Kontrol AI" | label |
| Select | `controller-select` | select |
| Button | `delegate-btn` | button (Kontrolü Devret) |
| Button | `reclaim-btn` | button (Kontrolü Devral) |

### LOG-PANELS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `log-panels` | div |
| Panel | `log-panel-incoming` | div |
| Header | `log-header` | div |
| Title | "AI → CoreEngine" | span |
| Content | `incoming-log` | div |
| Panel | `log-panel-outgoing` | div |
| Header | `log-header` | div |
| Title | "CoreEngine → AI" | span |
| Content | `outgoing-log` | div |

### COMMAND-TEST-SECTION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `command-test-section` | div |
| Container | `command-input-area` | div |
| Textarea | `command-input` | textarea |
| Button | `send-to-core` | button |
| Container | `command-helper` | div |
| Label | "Komut Ekle" | label |
| Select | `command-select` | select |
| Button | `add-command-btn` | button (+) |
| Label | "Kullanım Kılavuzu" | label |
| Textarea | `command-guide` | textarea |

---

## 8. PAGE: ARCHIVES (Arşiv Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ARCHIVES                                                               │
│ ┌────────────┬──────────────────────────────────────────────────────────┐ │
│ │   SIDEBAR    │                        MAIN-PANEL                        │ │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │Sohbetler │ │  │                   DETAIL-PANEL                      │ │ │
│ │ │○AI1 ○AI2 │ │  │ Başlık: [input]  Özet: [textarea]              │ │ │
│ │ ├──────────┤ │  │ Web URL: [url] [📋]  [Kaydet] [🗑️ Sil]          │ │ │
│ │ │ [Item 1] │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ │ [Item 2] │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [Item 3] │ │  │                   SEARCH-PANEL                     │ │ │
│ │ │ ...      │ │  │ Arama ○Mevcut ○Tüm  [🔍 input...      ×]       │ │ │
│ │ │          │ │  │ [Mesajlar(5)] [Dosyalar(2)]                       │ │ │
│ │ │          │ │  │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │          │ │  │ │ Result item with <mark>highlight</mark>         │ │ │ │
│ │ └──────────┘ │  │ └───────────────────────────────────────────────┘ │ │ │
│ └────────────┴──┴──└─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ARCHIVES-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archives-sidebar` | div |
| Header | `sidebar-header` | div |
| Title | "Sohbetler" | span |
| Container | `provider-toggle` | div |
| Radio | `archive-provider` | input, value="ai1" |
| Label | "AI1" | span |
| Radio | `archive-provider` | input, value="ai2" |
| Label | "AI2" | span |
| List | `archive-list` | div |
| Item | `archive-item` | div |

### ARCHIVE-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archive-item` | div |
| Icon | archive-icon | span (📄) |
| Title | `archive-title` | span |
| Summary | `archive-summary` | span |
| Meta | `archive-meta` | div |
| Date | `archive-date` | span |
| Count | `archive-count` | span |
| Button | `archive-delete` | button (🗑️) |

### DETAIL-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `detail-panel` | div |
| Header | `detail-header` | div |
| Title | "Sohbet Detayları" | span |
| Badge | `message-count` | span |
| Body | `detail-body` | div |
| Label | "Başlık" | label |
| Input | `detail-title` | input |
| Label | "Özet" | label |
| Textarea | `detail-summary` | textarea |
| Label | "Web URL" | label |
| Text | `detail-url` | span |
| Button | `copy-url-btn` | button (📋) |
| Container | `detail-actions` | div |
| Button | `save-detail-btn` | button (Kaydet) |
| Button | `delete-detail-btn` | button (Sil) |

### SEARCH-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `search-panel` | div |
| Header | `search-header` | div |
| Title | "Arama" | span |
| Container | `search-scope` | div |
| Radio | `search-scope` | input, value="current" |
| Label | "Mevcut" | span |
| Radio | `search-scope` | input, value="all" |
| Label | "Tüm" | span |
| Container | `search-input-wrap` | div |
| Icon | search-icon | span (🔍) |
| Input | `search-input` | input |
| Button | `search-clear` | button (×) |
| Container | `search-tabs` | div |
| Button | `tab-messages` | button |
| Button | `tab-files` | button |
| Container | `search-results` | div |
| Item | `search-result-item` | div |

---

## 9. PAGE: WHISPER (Fısıltı Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-WHISPER                                                                │
│ ┌───────────────────────────────────┬───────────────────────────────────┐ │
│ │        WHISPER-COLUMN (AI1)       │       WHISPER-COLUMN (AI2)        │ │
│ │ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │ │
│ │ │ COLUMN-HEADER: [AI1 Name]     │ │ │ COLUMN-HEADER: [AI2 Name]     │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ PENDING-SECTION               │ │ │ PENDING-SECTION               │ │ │
│ │ │ "Bekleyen Fısıltılar"          │ │ │ "Bekleyen Fısıltılar"          │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Whisper text...   [×] │ │ │ │ │ Whisper text...   [×] │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ DONE-SECTION                  │ │ │ DONE-SECTION                  │ │ │
│ │ │ "Tamamlanan Fısıltılar"        │ │ │ "Tamamlanan Fısıltılar"        │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Done whisper text      │ │ │ │ │ Done whisper text      │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ └───────────────────────────────┘ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┴───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WHISPER-COLUMN
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-column` | div |
| Header | `column-header` | div |
| Title | `column-title` | span (AI nickname) |
| Section | `pending-section` | div |
| Title | "Bekleyen Fısıltılar" | span |
| List | `pending-list-{slot}` | div |
| Section | `done-section` | div |
| Title | "Tamamlanan Fısıltılar" | span |
| List | `done-list-{slot}` | div |

### WHISPER-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-item` | div |
| Text | `whisper-text` | span |
| Dot | `whisper-status` | span |
| Button | `whisper-remove` | button (×) |

---

## 📝 NOTLAR

- `{slot}` = ai1 veya ai2 (dinamik değişken)
- Tüm ID'ler kebab-case formatında
- data-* attributeleri etkileşim için kullanılır
- Parantez içindeki değerler varsayılan içerik/ikonu gösterir

---

## 2. TOP-BAR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP-BAR                                                                     │
│ ┌─────────────────┬─────────────────────────────────────┬─────────────────┐ │
│ │ TOP-BAR-LEFT    │         TOP-BAR-CENTER              │ TOP-BAR-RIGHT   │ │
│ │                 │                                     │                 │ │
│ │ ┌────────────┐  │        ┌─────────────────┐         │ ┌─────────────┐ │ │
│ │ │ LOGO       │  │        │   INDICATORS    │         │ │ ICON-BTNS   │ │ │
│ │ │ ┌────┬───┐ │  │        │                 │         │ │ 🌙 ⏷ ➖ ⛶ ✕ │ │ │
│ │ │ │IMG │TXT│ │  │        │ (see below)     │         │ │             │ │ │
│ │ │ └────┴───┘ │  │        │                 │         │ └─────────────┘ │ │
│ │ └────────────┘  │        └─────────────────┘         │                 │ │
│ └─────────────────┴─────────────────────────────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SLOT-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `slot-card` | div |
| Header | `slot-header` | div |
| Row | `slot-header-top` | div |
| Wrapper | `slot-avatar-wrapper` | div |
| Image | `{slot}-avatar` | div |
| Dot | `{slot}-status-dot` | span |
| Container | `slot-info` | div |
| Text | `{slot}-nickname` | span |
| Select | `{slot}-account-select` | select |
| Container | `slot-actions` | div |
| Button | `{slot}-toggle-btn` | button |
| Button | `{slot}-devtools-btn` | button |
| Row | `slot-settings-row` | div |
| Grid | `slot-methods-grid` | div |
| Group | `setting-group` | div |
| Label | `setting-label` | label |
| Select | `{slot}-msg-method` | select |
| Select | `{slot}-file-method` | select |
| Label | `catch-label` | label |
| Checkbox | `{slot}-catch-check` | input |
| Bar | `slot-url-bar` | div |
| Text | `{slot}-url-display` | div |
| Container | `slot-webview-container` | div |
| Overlay | `{slot}-webview-overlay` | div |
| Icon | `overlay-icon` | div |
| Text | `overlay-title` | div |
| Text | `overlay-subtitle` | div |

### CONTROL-PANEL-ACCORDION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `control-panel-accordion` | div |
| Button | `settings-accordion-toggle` | button |
| Icon | `accordion-icon` | span (⚙️) |
| Text | `accordion-title` | span |
| Container | `accordion-badges` | span |
| Badge | `account-count` | span |
| Badge | `whisper-count` | span |
| Icon | `accordion-chevron` | span (▼) |
| Content | `settings-accordion-content` | div |
| Grid | `accordion-panels` | div |

### PANEL: USER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="user" |
| Icon | `panel-icon` | span (👤) |
| Title | `panel-title` | span |
| Wrapper | `user-avatar-wrapper` | div |
| Image | `user-avatar` | div |
| Overlay | `user-edit-overlay` | div (📷) |
| Input | `user-nickname-input` | input |
| Container | `gdrive-settings` | div |
| Status | `connection-status` | div |
| Dot | `gdrive-status-dot` | span |
| Text | `gdrive-status-text` | span |
| Input | `gdrive-client-id` | input |
| Input | `gdrive-client-secret` | input |
| Input | `gdrive-auth-code` | input |
| Button | `gdrive-start-auth` | button |
| Button | `gdrive-connect-btn` | button |

### PANEL: ACCOUNTS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="accounts" |
| Icon | `panel-icon` | span (📋) |
| Title | `panel-title` | span |
| List | `account-list` | div |
| Form | `account-form` | div |
| Text | `account-status-msg` | span |
| Input | `new-account-email` | input |
| Input | `new-account-nickname` | input |
| Select | `new-account-provider` | select |
| Preview | `new-account-avatar-preview` | div |
| Button | `new-account-avatar-browse` | button |
| Button | `settings-create-account` | button |
| Button | `settings-cancel-edit` | button |

### PANEL: WHISPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="whisper" |
| Icon | `panel-icon` | span (🎤) |
| Title | `panel-title` | span |
| Button | `whisper-clear-btn` | button |
| List | `whisper-pending-list` | div |

### PANEL: REPORT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="report" |
| Icon | `panel-icon` | span (📊) |
| Title | `panel-title` | span |
| Button | `report-modal-open` | button (⛶) |
| Content | `entrance-report-content` | div |

---

## 5. PAGE: ANALYZE (Analiz Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ANALYZE                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CONVERSATION-GRID                                                       │ │
│ │ ┌────────────────────────────────┬────────────────────────────────────┐ │ │
│ │ │        CONV-CARD (AI1)         │         CONV-CARD (AI2)            │ │ │
│ │ └────────────────────────────────┴────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMPOSE-ROW                                                             │ │
│ │ ┌─────────────┬───────────────────────────────────┬───────────────────┐ │ │
│ │ │COMPOSE-SIDE  │         COMPOSE-AREA              │   COMPOSE-FILES   │ │ │
│ │ └─────────────┴───────────────────────────────────┴───────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CONV-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `conv-card` | div |
| Header | `conv-header` | div |
| Container | `identity` | div |
| Avatar | `avatar-{slot}` | div |
| Text | `name-{slot}` | div |
| Text | `status-{slot}` | div |
| Container | `header-actions` | div |
| Select | `filter-count-{slot}` | select |
| Body | `messages-{slot}` | div |
| Placeholder | `message-placeholder` | div |

### COMPOSE-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-sidebar` | div |
| Button | `compose-start-btn` | button (📝 Analiz Sohbeti) |
| Group | `ai-chat-group` | div |
| Container | `relay-controls` | div |
| Radio | `relay-starter` | input, value="ai1" |
| Label | `relay-ai1-label` | span |
| Radio | `relay-starter` | input, value="ai2" |
| Label | `relay-ai2-label` | span |
| Button | `ai-chat-start` | button (🔄 AI-AI Sohbeti) |

### COMPOSE-AREA
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-area` | div |
| Textarea | `compose-input` | textarea |
| Container | `compose-actions` | div |
| Container | `send-controls` | div |
| Checkbox | `send-ai1` | input |
| Label | `send-ai1-label` | span |
| Checkbox | `send-ai2` | input |
| Label | `send-ai2-label` | span |
| Checkbox | `send-cross` | input |
| Label | "Çaprazla" | span |
| Button | `compose-send-btn` | button |

### COMPOSE-FILES
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-files` | div |
| Box | `upload-list` | div |
| Header | `files-header` | div |
| Button | `upload-add-btn` | button |

### READ-MODAL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `read-modal` | div |
| Content | `read-modal-content` | div |
| Header | `read-modal-header` | div |
| Button | `read-modal-close` | button |
| Body | `read-modal-body` | div |

---

## 6. PAGE: ASISTAN (Asistan Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ASISTAN                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-TOPBAR                                                          │ │
│ │ ┌───────────────────────────────────┬─────────────────────────────┐ │ │
│ │ │         CONTROLS-LEFT                 │      CONTROLS-RIGHT         │ │ │
│ │ └───────────────────────────────────┴─────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-NATIVE-PANEL (veya ASISTAN-WEBVIEW-PANEL)                       │ │
│ │                   ┌──────────────────────────┐                              │ │
│ │                   │     PLACEHOLDER          │                              │ │
│ │                   │     🤖 Native UI         │                              │ │
│ │                   │  Bağlan butonuna tıklayın│                              │ │
│ │                   └──────────────────────────┘                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ASISTAN-TOPBAR / CONTROLS-LEFT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-left` | div |
| Group | `control-group` | div |
| Label | "Provider" | label |
| Select | `asistan-provider-select` | select |
| Button | `asistan-connect-btn` | button |
| Container | `asistan-status` | div |
| Dot | `asistan-status-dot` | span |
| Text | `asistan-status-text` | span |
| Button | `asistan-devtools-btn` | button |
| Group | `ui-mode-toggle` | div |
| Label | "UI Modu" | label |
| Container | `toggle-buttons` | div |
| Button | `ui-mode-native` | button |
| Button | `ui-mode-webview` | button |

### ASISTAN-TOPBAR / CONTROLS-RIGHT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-right` | div |
| Button | `ai-asistan-relay-btn` | button |
| Label | "Kaynak" | label |
| Select | `ai-asistan-source` | select |

### ASISTAN-NATIVE-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-native-panel` | div |
| Placeholder | `native-placeholder` | div |
| Icon | placeholder-icon | span (🤖) |
| Text | placeholder-title | div |
| Text | placeholder-subtitle | div |

### ASISTAN-WEBVIEW-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-webview-panel` | div |
| Webview | `asistan-webview` | webview |

---

## 7. PAGE: SERVER (Sunucu Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-SERVER                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SERVER-TOPBAR                                                           │ │
│ │ Kontrol AI: [SELECT] [Devret] [Devral]                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────┬───────────────────────────────────────────────┐ │
│ │   LOG-PANEL-INCOMING   │              LOG-PANEL-OUTGOING               │ │
│ │   AI → CoreEngine      │              CoreEngine → AI                  │ │
│ └────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMMAND-TEST-SECTION                                                    │ │
│ │ ┌───────────────────────┬──────────────────────────────────────────────┐ │ │
│ │ │   COMMAND-INPUT       │               COMMAND-HELPER                  │ │ │
│ │ │ [textarea]            │ Komut Ekle: [SELECT][+]                       │ │ │
│ │ │ [CoreEngine'e Gönder] │ Kullanım Kılavuzu: [textarea]                 │ │ │
│ │ └───────────────────────┴──────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SERVER-TOPBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `server-topbar` | div |
| Label | "Kontrol AI" | label |
| Select | `controller-select` | select |
| Button | `delegate-btn` | button (Kontrolü Devret) |
| Button | `reclaim-btn` | button (Kontrolü Devral) |

### LOG-PANELS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `log-panels` | div |
| Panel | `log-panel-incoming` | div |
| Header | `log-header` | div |
| Title | "AI → CoreEngine" | span |
| Content | `incoming-log` | div |
| Panel | `log-panel-outgoing` | div |
| Header | `log-header` | div |
| Title | "CoreEngine → AI" | span |
| Content | `outgoing-log` | div |

### COMMAND-TEST-SECTION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `command-test-section` | div |
| Container | `command-input-area` | div |
| Textarea | `command-input` | textarea |
| Button | `send-to-core` | button |
| Container | `command-helper` | div |
| Label | "Komut Ekle" | label |
| Select | `command-select` | select |
| Button | `add-command-btn` | button (+) |
| Label | "Kullanım Kılavuzu" | label |
| Textarea | `command-guide` | textarea |

---

## 8. PAGE: ARCHIVES (Arşiv Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ARCHIVES                                                               │
│ ┌────────────┬──────────────────────────────────────────────────────────┐ │
│ │   SIDEBAR    │                        MAIN-PANEL                        │ │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │Sohbetler │ │  │                   DETAIL-PANEL                      │ │ │
│ │ │○AI1 ○AI2 │ │  │ Başlık: [input]  Özet: [textarea]              │ │ │
│ │ ├──────────┤ │  │ Web URL: [url] [📋]  [Kaydet] [🗑️ Sil]          │ │ │
│ │ │ [Item 1] │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ │ [Item 2] │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [Item 3] │ │  │                   SEARCH-PANEL                     │ │ │
│ │ │ ...      │ │  │ Arama ○Mevcut ○Tüm  [🔍 input...      ×]       │ │ │
│ │ │          │ │  │ [Mesajlar(5)] [Dosyalar(2)]                       │ │ │
│ │ │          │ │  │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │          │ │  │ │ Result item with <mark>highlight</mark>         │ │ │ │
│ │ └──────────┘ │  │ └───────────────────────────────────────────────┘ │ │ │
│ └────────────┴──┴──└─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ARCHIVES-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archives-sidebar` | div |
| Header | `sidebar-header` | div |
| Title | "Sohbetler" | span |
| Container | `provider-toggle` | div |
| Radio | `archive-provider` | input, value="ai1" |
| Label | "AI1" | span |
| Radio | `archive-provider` | input, value="ai2" |
| Label | "AI2" | span |
| List | `archive-list` | div |
| Item | `archive-item` | div |

### ARCHIVE-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archive-item` | div |
| Icon | archive-icon | span (📄) |
| Title | `archive-title` | span |
| Summary | `archive-summary` | span |
| Meta | `archive-meta` | div |
| Date | `archive-date` | span |
| Count | `archive-count` | span |
| Button | `archive-delete` | button (🗑️) |

### DETAIL-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `detail-panel` | div |
| Header | `detail-header` | div |
| Title | "Sohbet Detayları" | span |
| Badge | `message-count` | span |
| Body | `detail-body` | div |
| Label | "Başlık" | label |
| Input | `detail-title` | input |
| Label | "Özet" | label |
| Textarea | `detail-summary` | textarea |
| Label | "Web URL" | label |
| Text | `detail-url` | span |
| Button | `copy-url-btn` | button (📋) |
| Container | `detail-actions` | div |
| Button | `save-detail-btn` | button (Kaydet) |
| Button | `delete-detail-btn` | button (Sil) |

### SEARCH-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `search-panel` | div |
| Header | `search-header` | div |
| Title | "Arama" | span |
| Container | `search-scope` | div |
| Radio | `search-scope` | input, value="current" |
| Label | "Mevcut" | span |
| Radio | `search-scope` | input, value="all" |
| Label | "Tüm" | span |
| Container | `search-input-wrap` | div |
| Icon | search-icon | span (🔍) |
| Input | `search-input` | input |
| Button | `search-clear` | button (×) |
| Container | `search-tabs` | div |
| Button | `tab-messages` | button |
| Button | `tab-files` | button |
| Container | `search-results` | div |
| Item | `search-result-item` | div |

---

## 9. PAGE: WHISPER (Fısıltı Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-WHISPER                                                                │
│ ┌───────────────────────────────────┬───────────────────────────────────┐ │
│ │        WHISPER-COLUMN (AI1)       │       WHISPER-COLUMN (AI2)        │ │
│ │ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │ │
│ │ │ COLUMN-HEADER: [AI1 Name]     │ │ │ COLUMN-HEADER: [AI2 Name]     │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ PENDING-SECTION               │ │ │ PENDING-SECTION               │ │ │
│ │ │ "Bekleyen Fısıltılar"          │ │ │ "Bekleyen Fısıltılar"          │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Whisper text...   [×] │ │ │ │ │ Whisper text...   [×] │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ DONE-SECTION                  │ │ │ DONE-SECTION                  │ │ │
│ │ │ "Tamamlanan Fısıltılar"        │ │ │ "Tamamlanan Fısıltılar"        │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Done whisper text      │ │ │ │ │ Done whisper text      │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ └───────────────────────────────┘ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┴───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WHISPER-COLUMN
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-column` | div |
| Header | `column-header` | div |
| Title | `column-title` | span (AI nickname) |
| Section | `pending-section` | div |
| Title | "Bekleyen Fısıltılar" | span |
| List | `pending-list-{slot}` | div |
| Section | `done-section` | div |
| Title | "Tamamlanan Fısıltılar" | span |
| List | `done-list-{slot}` | div |

### WHISPER-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-item` | div |
| Text | `whisper-text` | span |
| Dot | `whisper-status` | span |
| Button | `whisper-remove` | button (×) |

---

## 📝 NOTLAR

- `{slot}` = ai1 veya ai2 (dinamik değişken)
- Tüm ID'ler kebab-case formatında
- data-* attributeleri etkileşim için kullanılır
- Parantez içindeki değerler varsayılan içerik/ikonu gösterir

### TOP-BAR-LEFT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `logo` | div |
| Image | `app-logo` | img |
| Text | `logo-text` | span |

### TOP-BAR-CENTER → INDICATORS
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ INDICATORS                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ INDICATORS-ROW (üst satır)                                              │ │
│ │ ┌──────────────┬───────────────┬──────────────┬───────────────┬───────┐ │ │
│ │ │ CLUSTER-AI1  │RELAY-WRAPPER-1│ CLUSTER-AI0  │RELAY-WRAPPER-2│CLUSTER│ │ │
│ │ │              │               │  (asistan)   │               │ -AI2  │ │ │
│ │ └──────────────┴───────────────┴──────────────┴───────────────┴───────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ RELAY-FLOW-LINE-BOTTOM-WRAPPER (alt satır)                              │ │
│ │ ┌──────────┬─────────────────────────────────────────────┬────────────┐ │ │
│ │ │ BTN-LEFT │          RELAY-FLOW-LINE-BOTTOM             │ BTN-RIGHT  │ │ │
│ │ └──────────┴─────────────────────────────────────────────┴────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SLOT-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `slot-card` | div |
| Header | `slot-header` | div |
| Row | `slot-header-top` | div |
| Wrapper | `slot-avatar-wrapper` | div |
| Image | `{slot}-avatar` | div |
| Dot | `{slot}-status-dot` | span |
| Container | `slot-info` | div |
| Text | `{slot}-nickname` | span |
| Select | `{slot}-account-select` | select |
| Container | `slot-actions` | div |
| Button | `{slot}-toggle-btn` | button |
| Button | `{slot}-devtools-btn` | button |
| Row | `slot-settings-row` | div |
| Grid | `slot-methods-grid` | div |
| Group | `setting-group` | div |
| Label | `setting-label` | label |
| Select | `{slot}-msg-method` | select |
| Select | `{slot}-file-method` | select |
| Label | `catch-label` | label |
| Checkbox | `{slot}-catch-check` | input |
| Bar | `slot-url-bar` | div |
| Text | `{slot}-url-display` | div |
| Container | `slot-webview-container` | div |
| Overlay | `{slot}-webview-overlay` | div |
| Icon | `overlay-icon` | div |
| Text | `overlay-title` | div |
| Text | `overlay-subtitle` | div |

### CONTROL-PANEL-ACCORDION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `control-panel-accordion` | div |
| Button | `settings-accordion-toggle` | button |
| Icon | `accordion-icon` | span (⚙️) |
| Text | `accordion-title` | span |
| Container | `accordion-badges` | span |
| Badge | `account-count` | span |
| Badge | `whisper-count` | span |
| Icon | `accordion-chevron` | span (▼) |
| Content | `settings-accordion-content` | div |
| Grid | `accordion-panels` | div |

### PANEL: USER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="user" |
| Icon | `panel-icon` | span (👤) |
| Title | `panel-title` | span |
| Wrapper | `user-avatar-wrapper` | div |
| Image | `user-avatar` | div |
| Overlay | `user-edit-overlay` | div (📷) |
| Input | `user-nickname-input` | input |
| Container | `gdrive-settings` | div |
| Status | `connection-status` | div |
| Dot | `gdrive-status-dot` | span |
| Text | `gdrive-status-text` | span |
| Input | `gdrive-client-id` | input |
| Input | `gdrive-client-secret` | input |
| Input | `gdrive-auth-code` | input |
| Button | `gdrive-start-auth` | button |
| Button | `gdrive-connect-btn` | button |

### PANEL: ACCOUNTS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="accounts" |
| Icon | `panel-icon` | span (📋) |
| Title | `panel-title` | span |
| List | `account-list` | div |
| Form | `account-form` | div |
| Text | `account-status-msg` | span |
| Input | `new-account-email` | input |
| Input | `new-account-nickname` | input |
| Select | `new-account-provider` | select |
| Preview | `new-account-avatar-preview` | div |
| Button | `new-account-avatar-browse` | button |
| Button | `settings-create-account` | button |
| Button | `settings-cancel-edit` | button |

### PANEL: WHISPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="whisper" |
| Icon | `panel-icon` | span (🎤) |
| Title | `panel-title` | span |
| Button | `whisper-clear-btn` | button |
| List | `whisper-pending-list` | div |

### PANEL: REPORT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="report" |
| Icon | `panel-icon` | span (📊) |
| Title | `panel-title` | span |
| Button | `report-modal-open` | button (⛶) |
| Content | `entrance-report-content` | div |

---

## 5. PAGE: ANALYZE (Analiz Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ANALYZE                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CONVERSATION-GRID                                                       │ │
│ │ ┌────────────────────────────────┬────────────────────────────────────┐ │ │
│ │ │        CONV-CARD (AI1)         │         CONV-CARD (AI2)            │ │ │
│ │ └────────────────────────────────┴────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMPOSE-ROW                                                             │ │
│ │ ┌─────────────┬───────────────────────────────────┬───────────────────┐ │ │
│ │ │COMPOSE-SIDE  │         COMPOSE-AREA              │   COMPOSE-FILES   │ │ │
│ │ └─────────────┴───────────────────────────────────┴───────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CONV-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `conv-card` | div |
| Header | `conv-header` | div |
| Container | `identity` | div |
| Avatar | `avatar-{slot}` | div |
| Text | `name-{slot}` | div |
| Text | `status-{slot}` | div |
| Container | `header-actions` | div |
| Select | `filter-count-{slot}` | select |
| Body | `messages-{slot}` | div |
| Placeholder | `message-placeholder` | div |

### COMPOSE-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-sidebar` | div |
| Button | `compose-start-btn` | button (📝 Analiz Sohbeti) |
| Group | `ai-chat-group` | div |
| Container | `relay-controls` | div |
| Radio | `relay-starter` | input, value="ai1" |
| Label | `relay-ai1-label` | span |
| Radio | `relay-starter` | input, value="ai2" |
| Label | `relay-ai2-label` | span |
| Button | `ai-chat-start` | button (🔄 AI-AI Sohbeti) |

### COMPOSE-AREA
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-area` | div |
| Textarea | `compose-input` | textarea |
| Container | `compose-actions` | div |
| Container | `send-controls` | div |
| Checkbox | `send-ai1` | input |
| Label | `send-ai1-label` | span |
| Checkbox | `send-ai2` | input |
| Label | `send-ai2-label` | span |
| Checkbox | `send-cross` | input |
| Label | "Çaprazla" | span |
| Button | `compose-send-btn` | button |

### COMPOSE-FILES
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-files` | div |
| Box | `upload-list` | div |
| Header | `files-header` | div |
| Button | `upload-add-btn` | button |

### READ-MODAL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `read-modal` | div |
| Content | `read-modal-content` | div |
| Header | `read-modal-header` | div |
| Button | `read-modal-close` | button |
| Body | `read-modal-body` | div |

---

## 6. PAGE: ASISTAN (Asistan Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ASISTAN                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-TOPBAR                                                          │ │
│ │ ┌───────────────────────────────────┬─────────────────────────────┐ │ │
│ │ │         CONTROLS-LEFT                 │      CONTROLS-RIGHT         │ │ │
│ │ └───────────────────────────────────┴─────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-NATIVE-PANEL (veya ASISTAN-WEBVIEW-PANEL)                       │ │
│ │                   ┌──────────────────────────┐                              │ │
│ │                   │     PLACEHOLDER          │                              │ │
│ │                   │     🤖 Native UI         │                              │ │
│ │                   │  Bağlan butonuna tıklayın│                              │ │
│ │                   └──────────────────────────┘                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ASISTAN-TOPBAR / CONTROLS-LEFT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-left` | div |
| Group | `control-group` | div |
| Label | "Provider" | label |
| Select | `asistan-provider-select` | select |
| Button | `asistan-connect-btn` | button |
| Container | `asistan-status` | div |
| Dot | `asistan-status-dot` | span |
| Text | `asistan-status-text` | span |
| Button | `asistan-devtools-btn` | button |
| Group | `ui-mode-toggle` | div |
| Label | "UI Modu" | label |
| Container | `toggle-buttons` | div |
| Button | `ui-mode-native` | button |
| Button | `ui-mode-webview` | button |

### ASISTAN-TOPBAR / CONTROLS-RIGHT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-right` | div |
| Button | `ai-asistan-relay-btn` | button |
| Label | "Kaynak" | label |
| Select | `ai-asistan-source` | select |

### ASISTAN-NATIVE-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-native-panel` | div |
| Placeholder | `native-placeholder` | div |
| Icon | placeholder-icon | span (🤖) |
| Text | placeholder-title | div |
| Text | placeholder-subtitle | div |

### ASISTAN-WEBVIEW-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-webview-panel` | div |
| Webview | `asistan-webview` | webview |

---

## 7. PAGE: SERVER (Sunucu Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-SERVER                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SERVER-TOPBAR                                                           │ │
│ │ Kontrol AI: [SELECT] [Devret] [Devral]                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────┬───────────────────────────────────────────────┐ │
│ │   LOG-PANEL-INCOMING   │              LOG-PANEL-OUTGOING               │ │
│ │   AI → CoreEngine      │              CoreEngine → AI                  │ │
│ └────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMMAND-TEST-SECTION                                                    │ │
│ │ ┌───────────────────────┬──────────────────────────────────────────────┐ │ │
│ │ │   COMMAND-INPUT       │               COMMAND-HELPER                  │ │ │
│ │ │ [textarea]            │ Komut Ekle: [SELECT][+]                       │ │ │
│ │ │ [CoreEngine'e Gönder] │ Kullanım Kılavuzu: [textarea]                 │ │ │
│ │ └───────────────────────┴──────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SERVER-TOPBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `server-topbar` | div |
| Label | "Kontrol AI" | label |
| Select | `controller-select` | select |
| Button | `delegate-btn` | button (Kontrolü Devret) |
| Button | `reclaim-btn` | button (Kontrolü Devral) |

### LOG-PANELS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `log-panels` | div |
| Panel | `log-panel-incoming` | div |
| Header | `log-header` | div |
| Title | "AI → CoreEngine" | span |
| Content | `incoming-log` | div |
| Panel | `log-panel-outgoing` | div |
| Header | `log-header` | div |
| Title | "CoreEngine → AI" | span |
| Content | `outgoing-log` | div |

### COMMAND-TEST-SECTION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `command-test-section` | div |
| Container | `command-input-area` | div |
| Textarea | `command-input` | textarea |
| Button | `send-to-core` | button |
| Container | `command-helper` | div |
| Label | "Komut Ekle" | label |
| Select | `command-select` | select |
| Button | `add-command-btn` | button (+) |
| Label | "Kullanım Kılavuzu" | label |
| Textarea | `command-guide` | textarea |

---

## 8. PAGE: ARCHIVES (Arşiv Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ARCHIVES                                                               │
│ ┌────────────┬──────────────────────────────────────────────────────────┐ │
│ │   SIDEBAR    │                        MAIN-PANEL                        │ │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │Sohbetler │ │  │                   DETAIL-PANEL                      │ │ │
│ │ │○AI1 ○AI2 │ │  │ Başlık: [input]  Özet: [textarea]              │ │ │
│ │ ├──────────┤ │  │ Web URL: [url] [📋]  [Kaydet] [🗑️ Sil]          │ │ │
│ │ │ [Item 1] │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ │ [Item 2] │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [Item 3] │ │  │                   SEARCH-PANEL                     │ │ │
│ │ │ ...      │ │  │ Arama ○Mevcut ○Tüm  [🔍 input...      ×]       │ │ │
│ │ │          │ │  │ [Mesajlar(5)] [Dosyalar(2)]                       │ │ │
│ │ │          │ │  │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │          │ │  │ │ Result item with <mark>highlight</mark>         │ │ │ │
│ │ └──────────┘ │  │ └───────────────────────────────────────────────┘ │ │ │
│ └────────────┴──┴──└─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ARCHIVES-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archives-sidebar` | div |
| Header | `sidebar-header` | div |
| Title | "Sohbetler" | span |
| Container | `provider-toggle` | div |
| Radio | `archive-provider` | input, value="ai1" |
| Label | "AI1" | span |
| Radio | `archive-provider` | input, value="ai2" |
| Label | "AI2" | span |
| List | `archive-list` | div |
| Item | `archive-item` | div |

### ARCHIVE-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archive-item` | div |
| Icon | archive-icon | span (📄) |
| Title | `archive-title` | span |
| Summary | `archive-summary` | span |
| Meta | `archive-meta` | div |
| Date | `archive-date` | span |
| Count | `archive-count` | span |
| Button | `archive-delete` | button (🗑️) |

### DETAIL-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `detail-panel` | div |
| Header | `detail-header` | div |
| Title | "Sohbet Detayları" | span |
| Badge | `message-count` | span |
| Body | `detail-body` | div |
| Label | "Başlık" | label |
| Input | `detail-title` | input |
| Label | "Özet" | label |
| Textarea | `detail-summary` | textarea |
| Label | "Web URL" | label |
| Text | `detail-url` | span |
| Button | `copy-url-btn` | button (📋) |
| Container | `detail-actions` | div |
| Button | `save-detail-btn` | button (Kaydet) |
| Button | `delete-detail-btn` | button (Sil) |

### SEARCH-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `search-panel` | div |
| Header | `search-header` | div |
| Title | "Arama" | span |
| Container | `search-scope` | div |
| Radio | `search-scope` | input, value="current" |
| Label | "Mevcut" | span |
| Radio | `search-scope` | input, value="all" |
| Label | "Tüm" | span |
| Container | `search-input-wrap` | div |
| Icon | search-icon | span (🔍) |
| Input | `search-input` | input |
| Button | `search-clear` | button (×) |
| Container | `search-tabs` | div |
| Button | `tab-messages` | button |
| Button | `tab-files` | button |
| Container | `search-results` | div |
| Item | `search-result-item` | div |

---

## 9. PAGE: WHISPER (Fısıltı Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-WHISPER                                                                │
│ ┌───────────────────────────────────┬───────────────────────────────────┐ │
│ │        WHISPER-COLUMN (AI1)       │       WHISPER-COLUMN (AI2)        │ │
│ │ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │ │
│ │ │ COLUMN-HEADER: [AI1 Name]     │ │ │ COLUMN-HEADER: [AI2 Name]     │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ PENDING-SECTION               │ │ │ PENDING-SECTION               │ │ │
│ │ │ "Bekleyen Fısıltılar"          │ │ │ "Bekleyen Fısıltılar"          │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Whisper text...   [×] │ │ │ │ │ Whisper text...   [×] │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ DONE-SECTION                  │ │ │ DONE-SECTION                  │ │ │
│ │ │ "Tamamlanan Fısıltılar"        │ │ │ "Tamamlanan Fısıltılar"        │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Done whisper text      │ │ │ │ │ Done whisper text      │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ └───────────────────────────────┘ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┴───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WHISPER-COLUMN
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-column` | div |
| Header | `column-header` | div |
| Title | `column-title` | span (AI nickname) |
| Section | `pending-section` | div |
| Title | "Bekleyen Fısıltılar" | span |
| List | `pending-list-{slot}` | div |
| Section | `done-section` | div |
| Title | "Tamamlanan Fısıltılar" | span |
| List | `done-list-{slot}` | div |

### WHISPER-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-item` | div |
| Text | `whisper-text` | span |
| Dot | `whisper-status` | span |
| Button | `whisper-remove` | button (×) |

---

## 📝 NOTLAR

- `{slot}` = ai1 veya ai2 (dinamik değişken)
- Tüm ID'ler kebab-case formatında
- data-* attributeleri etkileşim için kullanılır
- Parantez içindeki değerler varsayılan içerik/ikonu gösterir

### INDICATOR-CLUSTER (AI1/AI2)
| Obje | İsim | Tip |
|------|------|-----|
| Container | `indicator-cluster` | div |
| Avatar | `indicator-avatar-{slot}` | div |
| Row | `indicator-inline` | div |
| Pair | `indicator-pair` | div |
| Label | `indicator-label` | span |
| Dot | `{slot}-loading-indicator` | div |
| Dot | `{slot}-send-indicator` | div |
| Dot | `{slot}-thinking-indicator` | div |
| Row | `indicator-select-row` | div |
| Select | `conversation-{slot}` | select |
| Button | `conversation-refresh-{slot}` | button |

### INDICATOR-CLUSTER (AI0 - Asistan)
| Obje | İsim | Tip |
|------|------|-----|
| Container | `indicator-cluster asistan-cluster` | div |
| Avatar | `indicator-avatar-ai0` | div |
| Row | `indicator-inline asistan-inline` | div |
| Label | L, S, T (kısa) | span |
| Dot | `ai0-loading-indicator` | div |
| Dot | `ai0-send-indicator` | div |
| Dot | `ai0-thinking-indicator` | div |

### RELAY-FLOW-WRAPPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `relay-flow-wrapper` | div |
| Button | `relay-btn-{ai1-ai0/ai0-ai2}` | button |
| Icon | `relay-btn-icon` (⚡) | span |
| Line | `relay-flow-{ai1-ai0/ai0-ai2}` | div |
| Track | `flow-track` | div |
| Particle | `flow-particle` | div |

### RELAY-FLOW-LINE-BOTTOM-WRAPPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `relay-flow-line-bottom-wrapper` | div |
| Button Left | `relay-btn-ai1-ai2-left` | button |
| Line | `relay-flow-ai1-ai2` | div |
| Track | `flow-track-horizontal` | div |
| Particle | `flow-particle` | div |
| Button Right | `relay-btn-ai1-ai2-right` | button |

### TOP-BAR-RIGHT
| Obje | İsim | Tip |
|------|------|-----|
| Button | `theme-toggle` | button (🌙) |
| Button | `window-minimize-to-tray` | button (⏷) |
| Button | `window-minimize` | button (➖) |
| Button | `window-fullscreen` | button (⛶) |
| Button | `window-close` | button (✕) |

---

## 3. SIDE-NAV-OVERLAY (Sağ Kenar Menü)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                          SIDE-NAV-OVERLAY  │
│                                                         ┌────────────────┐ │
│                                                         │ SIDE-NAV-MENU  │ │
│                                                    ┌────┤                │ │
│                                                    │    │ ┌────────────┐ │ │
│                                          TRIGGER ──┤    │ │🏠 Giriş    │ │ │
│                                                    │    │ ├────────────┤ │ │
│                                                    │    │ │🔍 Analiz   │ │ │
│                                                    └────┤ ├────────────┤ │ │
│                                                         │ │🤖 Asistan  │ │ │
│                                                         │ ├────────────┤ │ │
│                                                         │ │🖥️ Sunucu   │ │ │
│                                                         │ ├────────────┤ │ │
│                                                         │ │📁 Arşiv    │ │ │
│                                                         │ ├────────────┤ │ │
│                                                         │ │👂 Fısıltı  │ │ │
│                                                         │ └────────────┘ │ │
│                                                         └────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

| Obje | İsim | Tip | Data |
|------|------|-----|------|
| Container | `side-nav-overlay` | div | - |
| Trigger | `side-nav-trigger` | div | hover zone |
| Menu | `side-nav-menu` | nav | - |
| Button | `side-nav-btn` | button | data-page="entrance" |
| Icon | `side-nav-icon` | span | 🏠 |
| Label | `side-nav-label` | span | "Giriş" |
| Button | `side-nav-btn` | button | data-page="analyze" |
| Icon | `side-nav-icon` | span | 🔍 |
| Label | `side-nav-label` | span | "Analiz" |
| Button | `side-nav-btn` | button | data-page="asistan" |
| Icon | `side-nav-icon` | span | 🤖 |
| Label | `side-nav-label` | span | "Asistan" |
| Button | `side-nav-btn` | button | data-page="server" |
| Icon | `side-nav-icon` | span | 🖥️ |
| Label | `side-nav-label` | span | "Sunucu" |
| Button | `side-nav-btn` | button | data-page="archives" |
| Icon | `side-nav-icon` | span | 📁 |
| Label | `side-nav-label` | span | "Arşiv" |
| Button | `side-nav-btn` | button | data-page="whisper" |
| Icon | `side-nav-icon` | span | 👂 |
| Label | `side-nav-label` | span | "Fısıltı" |

---

## 4. PAGE: ENTRANCE (Giriş Salonu)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ENTRANCE                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SLOT-GRID                                                               │ │
│ │ ┌────────────────────────────────┬────────────────────────────────────┐ │ │
│ │ │        SLOT-CARD (AI1)         │         SLOT-CARD (AI2)            │ │ │
│ │ └────────────────────────────────┴────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CONTROL-PANEL-ACCORDION                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SLOT-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `slot-card` | div |
| Header | `slot-header` | div |
| Row | `slot-header-top` | div |
| Wrapper | `slot-avatar-wrapper` | div |
| Image | `{slot}-avatar` | div |
| Dot | `{slot}-status-dot` | span |
| Container | `slot-info` | div |
| Text | `{slot}-nickname` | span |
| Select | `{slot}-account-select` | select |
| Container | `slot-actions` | div |
| Button | `{slot}-toggle-btn` | button |
| Button | `{slot}-devtools-btn` | button |
| Row | `slot-settings-row` | div |
| Grid | `slot-methods-grid` | div |
| Group | `setting-group` | div |
| Label | `setting-label` | label |
| Select | `{slot}-msg-method` | select |
| Select | `{slot}-file-method` | select |
| Label | `catch-label` | label |
| Checkbox | `{slot}-catch-check` | input |
| Bar | `slot-url-bar` | div |
| Text | `{slot}-url-display` | div |
| Container | `slot-webview-container` | div |
| Overlay | `{slot}-webview-overlay` | div |
| Icon | `overlay-icon` | div |
| Text | `overlay-title` | div |
| Text | `overlay-subtitle` | div |

### CONTROL-PANEL-ACCORDION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `control-panel-accordion` | div |
| Button | `settings-accordion-toggle` | button |
| Icon | `accordion-icon` | span (⚙️) |
| Text | `accordion-title` | span |
| Container | `accordion-badges` | span |
| Badge | `account-count` | span |
| Badge | `whisper-count` | span |
| Icon | `accordion-chevron` | span (▼) |
| Content | `settings-accordion-content` | div |
| Grid | `accordion-panels` | div |

### PANEL: USER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="user" |
| Icon | `panel-icon` | span (👤) |
| Title | `panel-title` | span |
| Wrapper | `user-avatar-wrapper` | div |
| Image | `user-avatar` | div |
| Overlay | `user-edit-overlay` | div (📷) |
| Input | `user-nickname-input` | input |
| Container | `gdrive-settings` | div |
| Status | `connection-status` | div |
| Dot | `gdrive-status-dot` | span |
| Text | `gdrive-status-text` | span |
| Input | `gdrive-client-id` | input |
| Input | `gdrive-client-secret` | input |
| Input | `gdrive-auth-code` | input |
| Button | `gdrive-start-auth` | button |
| Button | `gdrive-connect-btn` | button |

### PANEL: ACCOUNTS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="accounts" |
| Icon | `panel-icon` | span (📋) |
| Title | `panel-title` | span |
| List | `account-list` | div |
| Form | `account-form` | div |
| Text | `account-status-msg` | span |
| Input | `new-account-email` | input |
| Input | `new-account-nickname` | input |
| Select | `new-account-provider` | select |
| Preview | `new-account-avatar-preview` | div |
| Button | `new-account-avatar-browse` | button |
| Button | `settings-create-account` | button |
| Button | `settings-cancel-edit` | button |

### PANEL: WHISPER
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="whisper" |
| Icon | `panel-icon` | span (🎤) |
| Title | `panel-title` | span |
| Button | `whisper-clear-btn` | button |
| List | `whisper-pending-list` | div |

### PANEL: REPORT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `panel-item` | div, data-panel="report" |
| Icon | `panel-icon` | span (📊) |
| Title | `panel-title` | span |
| Button | `report-modal-open` | button (⛶) |
| Content | `entrance-report-content` | div |

---

## 5. PAGE: ANALYZE (Analiz Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ANALYZE                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CONVERSATION-GRID                                                       │ │
│ │ ┌────────────────────────────────┬────────────────────────────────────┐ │ │
│ │ │        CONV-CARD (AI1)         │         CONV-CARD (AI2)            │ │ │
│ │ └────────────────────────────────┴────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMPOSE-ROW                                                             │ │
│ │ ┌─────────────┬───────────────────────────────────┬───────────────────┐ │ │
│ │ │COMPOSE-SIDE  │         COMPOSE-AREA              │   COMPOSE-FILES   │ │ │
│ │ └─────────────┴───────────────────────────────────┴───────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CONV-CARD
| Obje | İsim | Tip |
|------|------|-----|
| Container | `conv-card` | div |
| Header | `conv-header` | div |
| Container | `identity` | div |
| Avatar | `avatar-{slot}` | div |
| Text | `name-{slot}` | div |
| Text | `status-{slot}` | div |
| Container | `header-actions` | div |
| Select | `filter-count-{slot}` | select |
| Body | `messages-{slot}` | div |
| Placeholder | `message-placeholder` | div |

### COMPOSE-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-sidebar` | div |
| Button | `compose-start-btn` | button (📝 Analiz Sohbeti) |
| Group | `ai-chat-group` | div |
| Container | `relay-controls` | div |
| Radio | `relay-starter` | input, value="ai1" |
| Label | `relay-ai1-label` | span |
| Radio | `relay-starter` | input, value="ai2" |
| Label | `relay-ai2-label` | span |
| Button | `ai-chat-start` | button (🔄 AI-AI Sohbeti) |

### COMPOSE-AREA
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-area` | div |
| Textarea | `compose-input` | textarea |
| Container | `compose-actions` | div |
| Container | `send-controls` | div |
| Checkbox | `send-ai1` | input |
| Label | `send-ai1-label` | span |
| Checkbox | `send-ai2` | input |
| Label | `send-ai2-label` | span |
| Checkbox | `send-cross` | input |
| Label | "Çaprazla" | span |
| Button | `compose-send-btn` | button |

### COMPOSE-FILES
| Obje | İsim | Tip |
|------|------|-----|
| Container | `compose-files` | div |
| Box | `upload-list` | div |
| Header | `files-header` | div |
| Button | `upload-add-btn` | button |

### READ-MODAL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `read-modal` | div |
| Content | `read-modal-content` | div |
| Header | `read-modal-header` | div |
| Button | `read-modal-close` | button |
| Body | `read-modal-body` | div |

---

## 6. PAGE: ASISTAN (Asistan Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ASISTAN                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-TOPBAR                                                          │ │
│ │ ┌───────────────────────────────────┬─────────────────────────────┐ │ │
│ │ │         CONTROLS-LEFT                 │      CONTROLS-RIGHT         │ │ │
│ │ └───────────────────────────────────┴─────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ASISTAN-NATIVE-PANEL (veya ASISTAN-WEBVIEW-PANEL)                       │ │
│ │                   ┌──────────────────────────┐                              │ │
│ │                   │     PLACEHOLDER          │                              │ │
│ │                   │     🤖 Native UI         │                              │ │
│ │                   │  Bağlan butonuna tıklayın│                              │ │
│ │                   └──────────────────────────┘                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ASISTAN-TOPBAR / CONTROLS-LEFT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-left` | div |
| Group | `control-group` | div |
| Label | "Provider" | label |
| Select | `asistan-provider-select` | select |
| Button | `asistan-connect-btn` | button |
| Container | `asistan-status` | div |
| Dot | `asistan-status-dot` | span |
| Text | `asistan-status-text` | span |
| Button | `asistan-devtools-btn` | button |
| Group | `ui-mode-toggle` | div |
| Label | "UI Modu" | label |
| Container | `toggle-buttons` | div |
| Button | `ui-mode-native` | button |
| Button | `ui-mode-webview` | button |

### ASISTAN-TOPBAR / CONTROLS-RIGHT
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-controls-right` | div |
| Button | `ai-asistan-relay-btn` | button |
| Label | "Kaynak" | label |
| Select | `ai-asistan-source` | select |

### ASISTAN-NATIVE-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-native-panel` | div |
| Placeholder | `native-placeholder` | div |
| Icon | placeholder-icon | span (🤖) |
| Text | placeholder-title | div |
| Text | placeholder-subtitle | div |

### ASISTAN-WEBVIEW-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `asistan-webview-panel` | div |
| Webview | `asistan-webview` | webview |

---

## 7. PAGE: SERVER (Sunucu Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-SERVER                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SERVER-TOPBAR                                                           │ │
│ │ Kontrol AI: [SELECT] [Devret] [Devral]                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────┬───────────────────────────────────────────────┐ │
│ │   LOG-PANEL-INCOMING   │              LOG-PANEL-OUTGOING               │ │
│ │   AI → CoreEngine      │              CoreEngine → AI                  │ │
│ └────────────────────────┴───────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMMAND-TEST-SECTION                                                    │ │
│ │ ┌───────────────────────┬──────────────────────────────────────────────┐ │ │
│ │ │   COMMAND-INPUT       │               COMMAND-HELPER                  │ │ │
│ │ │ [textarea]            │ Komut Ekle: [SELECT][+]                       │ │ │
│ │ │ [CoreEngine'e Gönder] │ Kullanım Kılavuzu: [textarea]                 │ │ │
│ │ └───────────────────────┴──────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SERVER-TOPBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `server-topbar` | div |
| Label | "Kontrol AI" | label |
| Select | `controller-select` | select |
| Button | `delegate-btn` | button (Kontrolü Devret) |
| Button | `reclaim-btn` | button (Kontrolü Devral) |

### LOG-PANELS
| Obje | İsim | Tip |
|------|------|-----|
| Container | `log-panels` | div |
| Panel | `log-panel-incoming` | div |
| Header | `log-header` | div |
| Title | "AI → CoreEngine" | span |
| Content | `incoming-log` | div |
| Panel | `log-panel-outgoing` | div |
| Header | `log-header` | div |
| Title | "CoreEngine → AI" | span |
| Content | `outgoing-log` | div |

### COMMAND-TEST-SECTION
| Obje | İsim | Tip |
|------|------|-----|
| Container | `command-test-section` | div |
| Container | `command-input-area` | div |
| Textarea | `command-input` | textarea |
| Button | `send-to-core` | button |
| Container | `command-helper` | div |
| Label | "Komut Ekle" | label |
| Select | `command-select` | select |
| Button | `add-command-btn` | button (+) |
| Label | "Kullanım Kılavuzu" | label |
| Textarea | `command-guide` | textarea |

---

## 8. PAGE: ARCHIVES (Arşiv Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-ARCHIVES                                                               │
│ ┌────────────┬──────────────────────────────────────────────────────────┐ │
│ │   SIDEBAR    │                        MAIN-PANEL                        │ │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │Sohbetler │ │  │                   DETAIL-PANEL                      │ │ │
│ │ │○AI1 ○AI2 │ │  │ Başlık: [input]  Özet: [textarea]              │ │ │
│ │ ├──────────┤ │  │ Web URL: [url] [📋]  [Kaydet] [🗑️ Sil]          │ │ │
│ │ │ [Item 1] │ │  └─────────────────────────────────────────────────────┘ │ │
│ │ │ [Item 2] │ │  ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [Item 3] │ │  │                   SEARCH-PANEL                     │ │ │
│ │ │ ...      │ │  │ Arama ○Mevcut ○Tüm  [🔍 input...      ×]       │ │ │
│ │ │          │ │  │ [Mesajlar(5)] [Dosyalar(2)]                       │ │ │
│ │ │          │ │  │ ┌───────────────────────────────────────────────┐ │ │ │
│ │ │          │ │  │ │ Result item with <mark>highlight</mark>         │ │ │ │
│ │ └──────────┘ │  │ └───────────────────────────────────────────────┘ │ │ │
│ └────────────┴──┴──└─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ARCHIVES-SIDEBAR
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archives-sidebar` | div |
| Header | `sidebar-header` | div |
| Title | "Sohbetler" | span |
| Container | `provider-toggle` | div |
| Radio | `archive-provider` | input, value="ai1" |
| Label | "AI1" | span |
| Radio | `archive-provider` | input, value="ai2" |
| Label | "AI2" | span |
| List | `archive-list` | div |
| Item | `archive-item` | div |

### ARCHIVE-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `archive-item` | div |
| Icon | archive-icon | span (📄) |
| Title | `archive-title` | span |
| Summary | `archive-summary` | span |
| Meta | `archive-meta` | div |
| Date | `archive-date` | span |
| Count | `archive-count` | span |
| Button | `archive-delete` | button (🗑️) |

### DETAIL-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `detail-panel` | div |
| Header | `detail-header` | div |
| Title | "Sohbet Detayları" | span |
| Badge | `message-count` | span |
| Body | `detail-body` | div |
| Label | "Başlık" | label |
| Input | `detail-title` | input |
| Label | "Özet" | label |
| Textarea | `detail-summary` | textarea |
| Label | "Web URL" | label |
| Text | `detail-url` | span |
| Button | `copy-url-btn` | button (📋) |
| Container | `detail-actions` | div |
| Button | `save-detail-btn` | button (Kaydet) |
| Button | `delete-detail-btn` | button (Sil) |

### SEARCH-PANEL
| Obje | İsim | Tip |
|------|------|-----|
| Container | `search-panel` | div |
| Header | `search-header` | div |
| Title | "Arama" | span |
| Container | `search-scope` | div |
| Radio | `search-scope` | input, value="current" |
| Label | "Mevcut" | span |
| Radio | `search-scope` | input, value="all" |
| Label | "Tüm" | span |
| Container | `search-input-wrap` | div |
| Icon | search-icon | span (🔍) |
| Input | `search-input` | input |
| Button | `search-clear` | button (×) |
| Container | `search-tabs` | div |
| Button | `tab-messages` | button |
| Button | `tab-files` | button |
| Container | `search-results` | div |
| Item | `search-result-item` | div |

---

## 9. PAGE: WHISPER (Fısıltı Odası)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE-WHISPER                                                                │
│ ┌───────────────────────────────────┬───────────────────────────────────┐ │
│ │        WHISPER-COLUMN (AI1)       │       WHISPER-COLUMN (AI2)        │ │
│ │ ┌───────────────────────────────┐ │ ┌───────────────────────────────┐ │ │
│ │ │ COLUMN-HEADER: [AI1 Name]     │ │ │ COLUMN-HEADER: [AI2 Name]     │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ PENDING-SECTION               │ │ │ PENDING-SECTION               │ │ │
│ │ │ "Bekleyen Fısıltılar"          │ │ │ "Bekleyen Fısıltılar"          │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Whisper text...   [×] │ │ │ │ │ Whisper text...   [×] │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ ├───────────────────────────────┤ │ ├───────────────────────────────┤ │ │
│ │ │ DONE-SECTION                  │ │ │ DONE-SECTION                  │ │ │
│ │ │ "Tamamlanan Fısıltılar"        │ │ │ "Tamamlanan Fısıltılar"        │ │ │
│ │ │ ┌───────────────────────────┐ │ │ │ ┌───────────────────────────┐ │ │ │
│ │ │ │ Done whisper text      │ │ │ │ │ Done whisper text      │ │ │ │
│ │ │ └───────────────────────────┘ │ │ │ └───────────────────────────┘ │ │ │
│ │ └───────────────────────────────┘ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┴───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WHISPER-COLUMN
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-column` | div |
| Header | `column-header` | div |
| Title | `column-title` | span (AI nickname) |
| Section | `pending-section` | div |
| Title | "Bekleyen Fısıltılar" | span |
| List | `pending-list-{slot}` | div |
| Section | `done-section` | div |
| Title | "Tamamlanan Fısıltılar" | span |
| List | `done-list-{slot}` | div |

### WHISPER-ITEM
| Obje | İsim | Tip |
|------|------|-----|
| Container | `whisper-item` | div |
| Text | `whisper-text` | span |
| Dot | `whisper-status` | span |
| Button | `whisper-remove` | button (×) |

---

## 📝 NOTLAR

- `{slot}` = ai1 veya ai2 (dinamik değişken)
- Tüm ID'ler kebab-case formatında
- data-* attributeleri etkileşim için kullanılır
- Parantez içindeki değerler varsayılan içerik/ikonu gösterir