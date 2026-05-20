import type { PatternRoomMockData } from "../types/pattern-room.js";

export const PATTERN_ROOM_MOCK_DATA: PatternRoomMockData = {
  roomTitle: "İz Sürme Odası",
  roomLabel: "Pattern Room",
  roomSummary:
    "Near-future dedektif ofisinde kanıt panosu, holografik masa ve temkinli rapor terminali.",
  subject: "Dünya’nın Şekli",
  boardCategories: [
    {
      id: "board-evidence",
      label: "Kanıt",
      tone: "evidence",
      summary: "Gözlenebilir kayıtlar ve ölçüm izleri tek panoda tutuluyor.",
      pins: ["Ufuk kaybolma etkisi", "Gölge açısı farkı"],
    },
    {
      id: "board-analysis",
      label: "Analiz",
      tone: "analysis",
      summary: "Masa çıktıları, iddiaların hangi gözleme dayandığını ayırıyor.",
      pins: ["Karşılaştırmalı rota", "Açı eşleştirmesi"],
    },
    {
      id: "board-commentary",
      label: "Yorum",
      tone: "commentary",
      summary: "Araştırmacı notları kesin sonuç yerine yorum katmanını görünür kılıyor.",
      pins: ["Lens etkisi uyarısı", "Perspektif itirazı"],
    },
    {
      id: "board-uncertainty",
      label: "Belirsizlik",
      tone: "uncertainty",
      summary: "Dummy fazda doğrulanmamış kaynak ve açık soru izleri saklanıyor.",
      pins: ["Kaynak güveni", "Eksik ölçüm bağlamı"],
    },
  ],
  claims: [
    {
      id: "claim-observed-horizon",
      label: "Ufuk gözlemi",
      summary: "Uzaklaşan cisimler gözlem çizgisinde kademeli olarak kayboluyor.",
      stance: "primary",
    },
    {
      id: "claim-perspective-counter",
      label: "Perspektif itirazı",
      summary: "Bazı görsel kayıtlar kaybolma etkisini yalnızca perspektifle açıklamayı deniyor.",
      stance: "counter",
    },
  ],
  sources: [
    {
      id: "source-navigation-log",
      label: "Seyir defteri",
      sourceTypeLabel: "Kitap / Metin",
      origin: "Dummy arşiv rafı",
      status: "mocked",
      note: "Uzun rota gözlemlerinden oluşturulmuş temsili kayıt.",
    },
    {
      id: "source-shadow-comparison",
      label: "Gölge karşılaştırması",
      sourceTypeLabel: "Görsel kaynak",
      origin: "Dummy lightbox kartı",
      status: "mocked",
      note: "Farklı konumlardaki gölge açılarının yan yana konduğu görsel özet.",
    },
    {
      id: "source-table-printout",
      label: "Masa çıktısı",
      sourceTypeLabel: "Masa çıktısı",
      origin: "Dummy masa çıktısı",
      status: "mocked",
      note: "Holografik masadan alınmış gibi duran yerel analiz fişi.",
    },
    {
      id: "source-orbit-photograph",
      label: "Yörünge fotoğrafı",
      sourceTypeLabel: "Belirsiz kaynak",
      origin: "Dummy kaynak kartı",
      status: "mocked",
      note: "Kaynak güvenilirliği henüz gerçek arşive bağlanmamış örnek görsel.",
    },
  ],
  tenthManSession: {
    id: "tenth-man-session-dummy",
    label: "Masaya bağlı 10. Adam cihazı",
    status: "dummy",
    prompt: "Mevcut panoya karşı en güçlü itirazları yalnızca yerel dummy notlarla hazırla.",
    roles: [
      {
        id: "role-ai0-researcher",
        label: "AI0 — Araştırmacı",
        note: "Kanıt izlerini düzenleyen temsili slot.",
      },
      {
        id: "role-ai1-defender",
        label: "AI1 — Savunucu",
        note: "Ana açıklamayı savunan temsili slot.",
      },
      {
        id: "role-ai2-tenth-man",
        label: "AI2 — 10. Adam / Karşıt",
        note: "Karşı argümanları yükselten temsili slot.",
      },
      {
        id: "role-us1-referee",
        label: "US1 — Hakem / Uzak kullanıcı",
        note: "Gerçek bağlantısı olmayan görsel hakem etiketi.",
      },
    ],
  },
  reportSummary: {
    id: "report-summary-dummy",
    label: "Küçük rapor terminali",
    status: "dummy",
    sections: [
      {
        id: "report-evidence",
        label: "Kanıtlar",
        tone: "evidence",
        note: "Gözlem kayıtları güçlü iz olarak duruyor, kesin hüküm üretmiyor.",
        bullets: ["Ufuk gözlemi ve gölge karşılaştırması aynı panoya bağlandı."],
      },
      {
        id: "report-analysis",
        label: "Analizler",
        tone: "analysis",
        note: "Masa, iddia ve itirazları aynı statik modelde yan yana tutuyor.",
        bullets: ["Masa çıktısı yalnızca yerel dummy veriyle temsil ediliyor."],
      },
      {
        id: "report-uncertainties",
        label: "Belirsizlikler",
        tone: "uncertainty",
        note: "Kaynak güveni ve ölçüm bağlamı sonraki araştırmaya bırakılıyor.",
        bullets: ["Belirsiz kaynak kartı gerçek arşiv bağlantısı kurmadan saklanıyor."],
      },
      {
        id: "report-next-notes",
        label: "Sonraki araştırma notları",
        tone: "commentary",
        note: "Bir sonraki faz için soru seti hazır, fakat otomasyon başlatmıyor.",
        bullets: ["10. Adam cihazı sadece rol etiketlerini ve itiraz promptunu gösteriyor."],
      },
    ],
  },
};
