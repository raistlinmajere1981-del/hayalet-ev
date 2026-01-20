# Hayalet-ev MCP Server

Rovodev CLI için Hayalet-ev projesi özel MCP (Model Context Protocol) Server.

**v1.7.0** - CDP + Filesystem + Dev Tools + Recycle Bin + Diff desteği ile!

## 🎯 Özellikler

- **51 Tool** - Dosya, geliştirme ve Electron kontrolü
- **Provider Validation** - AI selector'larını canlı test et
- **Recycle Bin** - Silinen dosyalar geri alınabilir
- **Diff** - Dosya/içerik karşılaştırma
- **Undo/Backup** - İşlem geri alma ve yedekleme
- **CDP** - Electron canlı kontrol

## Özellikler

### 🔧 Temel Tool'lar

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

### 🎯 CDP Tool'ları (Chrome DevTools Protocol)

Electron uygulamasına uzaktan bağlanıp kontrol etmek için güçlü araçlar:

6. **check_electron_connection** - CDP bağlantı durumunu kontrol et
   ```
   Örnek: "Electron'a bağlanabiliyor muyum?"
   ```

7. **send_command_to_electron** - JavaScript kodu çalıştır
   ```
   Örnek: "Electron'da document.title'ı al"
   Örnek: "window.location.href'i değiştir"
   ```

8. **take_cdp_screenshot** - Ekran görüntüsü al
   ```
   Örnek: "Electron penceresinin screenshot'ını al"
   ```

9. **get_electron_window_info** - Pencere bilgilerini al
   ```
   Örnek: "Electron penceresinin boyutları nedir?"
   ```

10. **click_element_by_selector** - CSS selector ile tıkla
    ```
    Örnek: "#submit-btn'e tıkla"
    Örnek: ".nav-item:first-child'a tıkla"
    ```

11. **click_element_by_text** - Metin içeriğine göre tıkla
    ```
    Örnek: "'Gönder' yazısına tıkla"
    Örnek: "button içinde 'Kaydet' yazana tıkla"
    ```

12. **fill_input_field** - Input alanına değer yaz
    ```
    Örnek: "#username input'una 'admin' yaz"
    ```

13. **get_page_dom_structure** - DOM yapısını al
    ```
    Örnek: "Sayfanın DOM yapısını göster"
    ```

14. **inspect_element** - Element bilgilerini incele
    ```
    Örnek: "#main-content elementini incele"
    ```

15. **query_elements** - Birden fazla elementi bul
    ```
    Örnek: "Sayfadaki tüm butonları bul"
    ```

16. **send_key_press** - Klavye tuşu gönder
    ```
    Örnek: "Enter tuşuna bas"
    Örnek: "Ctrl+S gönder"
    ```

### 📁 Filesystem Tool'ları

Local dosya sistemi ile etkileşim için araçlar:

17. **fs_open_files** - Dosyaları aç (collapsed view ile)
    ```
    Örnek: "src/js/app.ts dosyasını aç"
    Örnek: "Birden fazla dosya aç: index.ts, types.ts"
    ```

18. **fs_create_file** - Yeni dosya oluştur
    ```
    Örnek: "src/utils/helper.ts dosyası oluştur"
    ```

19. **fs_delete_file** - Dosya sil
    ```
    Örnek: "tmp.txt dosyasını sil"
    ```

20. **fs_move_file** - Dosya taşı/yeniden adlandır
    ```
    Örnek: "old.ts'i new.ts olarak yeniden adlandır"
    ```

21. **fs_expand_code_chunks** - Kod sembollerini genişlet
    ```
    Örnek: "CoreEngine class'ını göster"
    Örnek: "parseConfig fonksiyonunu genişlet"
    Örnek: "MyClass/myMethod nested sembolünü bul"
    ```

22. **fs_find_and_replace** - Dosyada bul/değiştir
    ```
    Örnek: "config.ts'de 'localhost' yerine '127.0.0.1' yaz"
    ```

23. **fs_grep** - Dosyalarda ara (regex + glob)
    ```
    Örnek: "Projede 'TODO' içeren satırları bul"
    Örnek: "*.test.ts dosyalarında 'describe' ara"
    ```

24. **fs_expand_folder** - Klasör yapısını göster
    ```
    Örnek: "src klasörünün yapısını göster"
    ```

25. **fs_bash** - Shell komutu çalıştır
    ```
    Örnek: "npm run lint çalıştır"
    Örnek: "git status"
    ```

26. **fs_create_plan** - Teknik plan oluştur
    ```
    Örnek: "Bu değişiklik için plan oluştur"
    ```

### 🛠️ Dev Tool'ları

Geliştirme workflow'ları için araçlar (eski npm scriptlerinin yerine):

27. **dev_analyze_project** - Proje analizi
    ```
    Örnek: "Proje istatistiklerini göster"
    Modlar: summary, deps, modules, full
    ```

28. **dev_bootstrap_context** - Session context üret
    ```
    Örnek: "Yeni session için context oluştur"
    (.rovodev/context.md dosyasını günceller)
    ```

29. **dev_find_unused** - Kullanılmayan export'ları bul
    ```
    Örnek: "Dead code var mı kontrol et"
    ```

30. **dev_generate_diagram** - Bağımlılık diagramı
    ```
    Örnek: "Modül bağımlılık diagramı oluştur"
    Formatlar: mermaid, dot
    ```

31. **dev_update_cache** - Proje cache güncelle
    ```
    Örnek: "Cache'i güncelle"
    ```

32. **dev_edit_lines** - Satır bazlı düzenleme
    ```
    Örnek: "100-150 arası satırları göster"
    İşlemler: show, replace, delete, insert
    ```

33. **dev_git_diff** - Git değişikliklerini göster
    ```
    Örnek: "Staged değişiklikleri göster"
    ```

34. **dev_lint_file** - Tek dosyada ESLint çalıştır
    ```
    Örnek: "src/app.ts dosyasını lint et"
    ```

35. **dev_search_symbol** - Projede sembol ara
    ```
    Örnek: "CoreEngine class'ını bul"
    Tipler: function, class, interface, type, const
    ```

36. **dev_test_run** - Test çalıştır
    ```
    Örnek: "utils testlerini çalıştır"
    ```

### 🗑️ Recycle Bin Tool'ları

37. **fs_trash_list** - Çöp kutusunu listele
    ```
    Örnek: "Silinen dosyaları göster"
    ```

38. **fs_restore** - Çöp kutusundan geri yükle
    ```
    Örnek: "Son silinen dosyayı geri al"
    ```

39. **fs_trash_empty** - Çöp kutusunu boşalt
    ```
    Örnek: "7 günden eski dosyaları sil"
    ```

40. **fs_backup** - Dosya yedeği al
    ```
    Örnek: "config.ts'in yedeğini al"
    ```

41. **fs_undo** - Son işlemi geri al
    ```
    Örnek: "Son silme işlemini geri al"
    ```

42. **fs_history** - İşlem geçmişini göster
    ```
    Örnek: "Son 10 işlemi listele"
    ```

### 📊 Diff Tool'ları

43. **fs_diff** - İki dosyayı karşılaştır
    ```
    Örnek: "package.json ile package.json.bak karşılaştır"
    ```

44. **fs_diff_content** - İki içeriği karşılaştır
    ```
    Örnek: "Eski ve yeni kodu karşılaştır"
    ```

45. **fs_show** - Dosya içeriğini göster
    ```
    Örnek: "50-100 arası satırları göster"
    ```

### 🔍 Provider Tool'ları

AI provider (ChatGPT, Gemini, Grok) selector'larını doğrulama araçları:

46. **list_provider_webviews** - Provider ve webview listesi
    ```
    Örnek: "Hangi provider'lar bağlı?"
    ```

47. **list_provider_selectors** - Config'deki selector'ları listele
    ```
    Örnek: "ChatGPT config'indeki selector'ları göster"
    ```

48. **validate_provider_selectors** - Selector'ları canlı test et
    ```
    Örnek: "ChatGPT selector'larını doğrula"
    Çıktı: ✅ inputField (1 element), ❌ stopButton
    ```

49. **inspect_provider_element** - Webview'da element inspect et
    ```
    Örnek: "ChatGPT'de kullanıcı mesaj balonunu inspect et"
    Çıktı: Tag, Class, Attributes, Pozisyon
    ```

17. **scroll_page** - Sayfada scroll yap
    ```
    Örnek: "Sayfayı 500px aşağı kaydır"
    ```

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
