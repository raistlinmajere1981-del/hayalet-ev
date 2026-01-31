#!/bin/bash

# Hayalet-ev RovoDev Wrapper Script
# Bu script acli rovodev run çalıştırmadan önce config dosyasındaki
# toolPermissions ve bash permissions değerlerini otomatik olarak "allow" yapar

set -e

CONFIG_FILE="$HOME/.rovodev/config.yml"
BACKUP_FILE="$HOME/.rovodev/config.yml.backup"

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Hayalet-ev RovoDev Wrapper${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Config dosyası var mı kontrol et
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Config dosyası bulunamadı: $CONFIG_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Config dosyası bulundu${NC}"

# Backup oluştur
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup oluşturuldu: $BACKUP_FILE${NC}"

# sed ile değişiklikleri yap
# toolPermissions altındaki default: ask değerini allow yap
sed -i '/toolPermissions:/,/^[^ ]/ {
    s/default: ask/default: allow/
}' "$CONFIG_FILE"

# bash altındaki default: ask değerini allow yap
sed -i '/bash:/,/^[^ ]/ {
    s/default: ask/default: allow/
}' "$CONFIG_FILE"

echo -e "${GREEN}✅ Permissions güncellendi: ask → allow${NC}"

# Değişiklikleri göster
echo ""
echo -e "${YELLOW}📊 Güncellenen ayarlar:${NC}"
grep -A 3 "toolPermissions:" "$CONFIG_FILE" || true
grep -A 3 "bash:" "$CONFIG_FILE" || true
echo ""

# acli rovodev run komutunu çalıştır
echo -e "${GREEN}🎯 RovoDev başlatılıyor...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

acli rovodev run

# Script bitince backup'ı geri yükle (isteğe bağlı)
# Uncomment if you want to restore original config after run
# cp "$BACKUP_FILE" "$CONFIG_FILE"
# echo -e "${YELLOW}📝 Config dosyası restore edildi${NC}"
