# Hayalet-ev Plugin

Hayalet-ev projesine özel Claude Code komutları.

## Komutlar

### `/hayalet-ev:add-webview [provider-name]`
Yeni bir AI provider webview ekler.

**Örnek:**
```
/hayalet-ev:add-webview perplexity
/hayalet-ev:add-webview ollama
```

**Ne yapar:**
- `src/js/modules/webview/` altında yeni provider dosyası oluşturur
- Webview manager'a kaydeder
- UI'a buton ekler
- Test için geliştirme modunda çalıştırır

### `/hayalet-ev:create-plugin [plugin-name]`
Yeni bir plugin yapısı oluşturur.

**Örnek:**
```
/hayalet-ev:create-plugin theme-manager
/hayalet-ev:create-plugin auto-translator
```

**Ne yapar:**
- `plugins/` altında yeni klasör oluşturur
- Manifest dosyası hazırlar
- Temel plugin template'ini ekler

### `/hayalet-ev:test-electron`
Electron uygulamasını geliştirme modunda çalıştırır.

**Örnek:**
```
/hayalet-ev:test-electron
```

**Ne yapar:**
- Bağımlılıkları kontrol eder
- `npm run dev` ile çalıştırır
- Console output'u izler
- Hataları tespit eder

## Kurulum

```bash
# Plugin marketplace'e ekle
/plugin marketplace add /path/to/hayalet-ev

# Plugin'i yükle
/plugin install hayalet-ev
```

## Geliştirme

Yeni komut eklemek için:

1. `commands/` altında yeni `.md` dosyası oluştur
2. YAML frontmatter ekle (argument-hint, description, allowed-tools)
3. Komut adımlarını markdown olarak yaz
4. `plugin.json`'da version'ı artır
5. Test et

## Yapı

```
plugins/hayalet-ev/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── add-webview.md
│   ├── create-plugin.md
│   └── test-electron.md
└── README.md
```

## Lisans

MIT
