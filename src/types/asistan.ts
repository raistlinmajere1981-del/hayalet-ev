/**
 * Asistan Page Types
 *
 * AsistanController ve provider adapter'lar için
 * ortak tip tanımları ve interface'ler.
 *
 * @module src/types/asistan
 */

// ============================================
// Enums
// ============================================

export enum ConnectButtonState {
  IDLE = "idle", // "Başlat" - başlangıç durumu
  STARTING = "starting", // "Başlatılıyor..." - server başlatılıyor
  CANCEL_CONNECTING = "cancel_connecting", // "Bağlantıyı İptal" - bağlantı kurulurken iptal edilebilir
  CONNECTED = "connected", // "Bağlantıyı Kes" - bağlantı aktif
  STOPPING = "stopping", // "Kesiliyor..." - bağlantı kesiliyor
  ERROR = "error", // "Hata!" - hata durumu
  SUCCESS_START = "success_start", // "Bağlandı!" - geçici başarı mesajı
  SUCCESS_STOP = "success_stop", // "Kesildi!" - geçici başarı mesajı
}

// ============================================
// UI Interfaces
// ============================================

export interface ButtonStateConfig {
  text: string;
  classes: string[];
  disabled: boolean;
}

export interface WebviewElement extends HTMLElement {
  src?: string;
  getWebContentsId?: () => number;
  getURL?: () => string;
  openDevTools?: () => void;
  executeJavaScript?: (script: string) => Promise<unknown>;
}

// ============================================
// State Interfaces
// ============================================

export interface SlotStateInfo {
  state?: string;
  accountId?: string | null;
  currentUrl?: string;
  error?: string;
}

export interface ServerResult {
  success: boolean;
  url?: string;
  error?: string;
  alreadyRunning?: boolean;
  existingServer?: boolean;
  workspaceId?: string;
}

export interface AsistanTrafficState {
  state?: {
    status?: {
      loading?: string;
      thinking?: string;
      send?: string;
    };
  };
}

export interface ServerStatus {
  running: boolean;
  port?: number;
}

// ============================================
// Provider Adapter Interface
// ============================================

/**
 * Asistan provider adapter interface.
 *
 * Yeni bir asistan provider eklemek için bu interface'i implement edin:
 * 1. `src/js/pages/asistan/my-provider-adapter.ts` oluşturun
 * 2. `AsistanProviderAdapter` interface'ini implement edin
 * 3. `provider-registry.ts`'de adapter'ı kaydedin
 */
export interface AsistanProviderAdapter {
  /** Provider kimliği (ör: "opencode", "opencode-ui") */
  readonly id: string;

  /** Provider görünen adı */
  readonly name: string;

  /**
   * Server'ı başlat
   * @param portSelection - Kullanıcının seçtiği port ("auto" veya sayı string'i)
   * @returns Server başlatma sonucu
   */
  startServer(portSelection?: string): Promise<ServerResult>;

  /**
   * Server'ı durdur
   * @returns Durdurma sonucu
   */
  stopServer(): Promise<ServerResult>;

  /**
   * Server'ın hazır olup olmadığını kontrol et
   * @param url - Kontrol edilecek URL
   * @param timeoutMs - Timeout süresi (ms)
   * @returns Hazır mı?
   */
  waitForReady(url: string, timeoutMs?: number, signal?: AbortSignal): Promise<boolean>;

  /**
   * Server durumunu UI'a yansıt
   * @param status - Güncel durum bilgisi
   */
  getServerStatus(): ServerStatus;

  /**
   * Dış kontrol için running state'i değiştir (sayfa açılışı restore için)
   */
  setRunning(value: boolean): void;
}
