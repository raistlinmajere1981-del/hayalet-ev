# Hayalet-ev MCP Server

Rovodev CLI için Hayalet-ev projesi özel MCP (Model Context Protocol) Server.

## Özellikler

### 🔧 Tools (Fonksiyonlar)

1. **list_providers** - Mevcut AI provider'ları listele
   ```
   Örnek: "Hangi AI provider'lar var?"
   ```

2. **add_provider** - Yeni AI provider ekle
   ```
   Örnek: "Perplexity provider'ını ekle, URL'i https://www.perplexity.ai"
   ```

3. **test_electron** - Electron uygulamasını test et
   ```
   Örnek: "Electron'u 10 saniye test et"
   ```

4. **list_plugins** - Mevcut plugin'leri listele
   ```
   Örnek: "Hangi plugin'ler yüklü?"
   ```

5. **read_electron_logs** - Electron console ve error loglarını oku
   ```
   Örnek: "Electron loglarını göster"
   Örnek: "Son 100 satır error logu"
   Örnek: "Console loglarını oku"
   ```
   
   **ÖNEMLİ:** Bu tool sayesinde AI, Electron'u çalıştırdıktan sonra runtime hatalarını görebilir!

## Kurulum

### 1. Bağımlılıkları Yükle
```bash
cd mcp-server
npm install
```

### 2. Rovodev'e Kaydet

`~/.rovodev/mcp.json` dosyasını düzenle:

```json
{
    "mcpServers": {
        "hayalet-ev": {
            "command": "node",
            "args": ["/tam/yol/hayalet-ev/mcp-server/index.js"],
            "env": {}
        }
    }
}
```

veya komut satırından:

```bash
acli rovodev config mcp add hayalet-ev \
  --command "node" \
  --args "/tam/yol/hayalet-ev/mcp-server/index.js"
```

### 3. Rovodev'i Yeniden Başlat

```bash
# Varsa çalışan instance'ı kapat
pkill -f "acli rovodev"

# Yeniden başlat (CLI veya web)
acli rovodev
```

## Kullanım Örnekleri

### Doğal Dille Komut Ver

MCP Server aktif olduğunda, Rovodev'e **doğal dilde** istekte bulunabilirsin:

```
Sen: "Hayalet-ev'de hangi AI provider'lar var?"
Rovodev: [list_providers tool'unu çağırır]
         "Mevcut AI Provider'lar:
         - claude
         - chatgpt
         - gemini
         - grok"

Sen: "Perplexity ekle, URL'i https://www.perplexity.ai"
Rovodev: [add_provider tool'unu çağırır]
         "✅ Provider eklendi: src/js/modules/webview/perplexity-view.js
         
         Sonraki adımlar:
         1. electron/webview-manager.js'ye kaydet
         2. UI'da buton ekle
         3. npm run dev ile test et"

Sen: "Plugin'leri listele"
Rovodev: [list_plugins tool'unu çağırır]
         "Hayalet-ev Plugin'leri:
         - git (1.1.1): Git Development Workflows
         - claude (1.0.3): Claude Development Plugin"
```

### AI Otomatik Karar Verir

```
Sen: "Hayalet-ev'e DeepSeek AI'ı entegre et"

Rovodev:
1. [list_providers] → Mevcut provider'ları kontrol eder
2. [add_provider] → DeepSeek provider dosyası oluşturur
3. [Kod değişiklikleri] → webview-manager.js'yi günceller
4. [test_electron] → Uygulamayı test eder
```

## Debug

MCP Server loglarını görmek için:

```bash
# Server'ı manuel başlat
cd mcp-server
node index.js

# Rovodev'den tool çağır ve logları gör
```

## Geliştirme

Yeni tool eklemek için `index.js` dosyasını düzenle:

1. `ListToolsRequestSchema` handler'a yeni tool tanımı ekle
2. `CallToolRequestSchema` handler'a case ekle
3. npm restart yap

## Notlar

- MCP Server **stdio** protokolü kullanır (stdin/stdout)
- Rovodev otomatik olarak tool'ları keşfeder ve kullanır
- AI, hangi tool'u ne zaman kullanacağına kendi karar verir
- Tool açıklamaları AI'nin doğru seçim yapması için önemli

## Troubleshooting

**Server başlamıyor:**
```bash
# Node.js versiyonu kontrol et (18+ olmalı)
node --version

# Bağımlılıkları yeniden yükle
rm -rf node_modules package-lock.json
npm install
```

**Rovodev tool'u görmüyor:**
```bash
# mcp.json'da yol doğru mu kontrol et
cat ~/.rovodev/mcp.json

# Rovodev'i yeniden başlat
pkill -f "acli rovodev" && acli rovodev
```
