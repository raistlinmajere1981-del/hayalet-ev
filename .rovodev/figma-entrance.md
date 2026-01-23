# 🎨 FIGMA COMPONENT LİSTESİ
## Top-Bar, Menu ve Entrance Sayfası

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

### SLOT-CARD (Detaylı)
```
┌─────────────────────────────────────────────────────────────────┐
│ SLOT-CARD                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SLOT-HEADER                                                 │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ SLOT-HEADER-TOP                                         │ │ │
│ │ │ ┌──────────────┬────────────────┬─────────────────────┐ │ │ │
│ │ │ │ AVATAR-WRAP  │   SLOT-INFO    │    SLOT-ACTIONS     │ │ │ │
│ │ │ │ ┌────────┐   │ ┌────────────┐ │ ┌───────┐ ┌───────┐ │ │ │ │
│ │ │ │ │ AVATAR │   │ │ NICKNAME   │ │ │CONNECT│ │DEVTOOL│ │ │ │ │
│ │ │ │ │   ●    │   │ ├────────────┤ │ │  BTN  │ │  BTN  │ │ │ │ │
│ │ │ │ │ STATUS │   │ │ ACCOUNT    │ │ └───────┘ └───────┘ │ │ │ │
│ │ │ │ │  DOT   │   │ │  SELECT    │ │                     │ │ │ │
│ │ │ │ └────────┘   │ └────────────┘ │                     │ │ │ │
│ │ │ └──────────────┴────────────────┴─────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ SLOT-SETTINGS-ROW                                       │ │ │
│ │ │ ┌─────────────────────────────────┬───────────────────┐ │ │ │
│ │ │ │ SLOT-METHODS-GRID               │   CATCH-LABEL     │ │ │ │
│ │ │ │ ┌──────────────┬──────────────┐ │ ┌───────────────┐ │ │ │ │
│ │ │ │ │ SETTING-GROUP│ SETTING-GROUP│ │ │☑ Komutları    │ │ │ │ │
│ │ │ │ │ Mesaj:[SEL]  │ Dosya:[SEL]  │ │ │   Yakala      │ │ │ │ │
│ │ │ │ └──────────────┴──────────────┘ │ └───────────────┘ │ │ │ │
│ │ │ └─────────────────────────────────┴───────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SLOT-URL-BAR                                                │ │
│ │ │ slot-url: https://chatgpt.com/...                       │ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SLOT-WEBVIEW-CONTAINER                                      │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ WEBVIEW-OVERLAY (görünür/gizli)                         │ │ │
│ │ │ ┌─────────────────────────────────────────────────────┐ │ │ │
│ │ │ │           🔌                                        │ │ │ │
│ │ │ │    overlay-title: Hesap Seçilmedi                   │ │ │ │
│ │ │ │    overlay-subtitle: Yukarıdan hesap seçin          │ │ │ │
│ │ │ └─────────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### SLOT-CARD Objeleri
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
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROL-PANEL-ACCORDION                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ACCORDION-TOGGLE                                                        │ │
│ │ [⚙️] [Ayarlar] [Hesap: 3] [Whisper: 2]                             [▼] │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ACCORDION-CONTENT (açık/kapalı)                                         │ │
│ │ ┌───────────────┬───────────────┬───────────────┬───────────────┐       │ │
│ │ │  PANEL-USER   │PANEL-ACCOUNTS │ PANEL-WHISPER │ PANEL-REPORT  │       │ │
│ │ │      👤       │      📋       │      🎤       │      📊       │       │ │
│ │ └───────────────┴───────────────┴───────────────┴───────────────┘       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ACCORDION Objeleri
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

## 📝 NOTLAR

- Ciddi, profosyonel bir tasarım olsun, hayalet projenin adı sadece, tasarımda hayalet kavramını kullanma
- topbardaki slot alanları (göstergeler, listeler, butonlar) ve aralarındaki relay ilişkilerini görsel olarak göster
