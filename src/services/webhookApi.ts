// Servicio para enviar documentos a n8n webhook
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { addToOutbox, getPendingCount } from '@/lib/outbox';

interface UploadDocumentOptions {
  file: Blob;
  filename: string;
  projectName: string;
  type: 'pdf' | 'docx';
  metadata?: Record<string, any>;
}

export class WebhookApi {
  private static webhookUrl: string = 'https://n8n.n8n.instalia.synology.me/webhook/Carga_Partes';

  // Configurar URL del webhook
  static setWebhookUrl(url: string): void {
    this.webhookUrl = url;
    localStorage.setItem('webhook_url', url);
  }

  // Obtener URL del webhook
  static getWebhookUrl(): string {
    return this.webhookUrl || localStorage.getItem('webhook_url') || '';
  }

  // Verificar si hay webhook configurado
  static hasWebhook(): boolean {
    return !!this.getWebhookUrl();
  }

  // Enviar documento al webhook
  static async uploadDocument(options: UploadDocumentOptions): Promise<boolean> {
    const { file, filename, projectName, type, metadata = {} } = options;

    console.log('📤 uploadDocument llamado:', { filename, type, size: file.size });

    if (!this.hasWebhook()) {
      console.warn('⚠️ No hay webhook configurado, saltando envío');
      return false;
    }

    console.log('🌐 Webhook URL:', this.webhookUrl);

    try {
      // Convertir blob a base64
      console.log('🔄 Convirtiendo archivo a base64...');
      const base64 = await this.blobToBase64(file);
      console.log('✅ Base64 generado, longitud:', base64.length);

      // Preparar datos para enviar
      const payload = {
        filename,
        projectName,
        type,
        size: file.size,
        timestamp: new Date().toISOString(),
        data: base64,
        ...metadata
      };

      console.log('📦 Payload preparado:', {
        filename: payload.filename,
        projectName: payload.projectName,
        type: payload.type,
        size: payload.size,
        dataLength: payload.data.length
      });

      // Verificar conexión real
      const isOnline = navigator.onLine && await this.checkConnection();
      console.log('🌐 Estado de conexión:', { navigatorOnline: navigator.onLine, checkPassed: isOnline });

      if (!isOnline) {
        console.warn('📴 Sin conexión, encolando documento');
        // Sin conexión: guardar en cola offline
        return await this.queueForOfflineSync(payload, filename);
      }

      console.log(`📤 Enviando ${type.toUpperCase()} a webhook:`, filename);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📨 Respuesta del servidor:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const respText = await response.clone().text().catch(() => '');
      console.log('📄 Texto de respuesta:', respText);

      if (response.ok) {
        console.log(`✅ ${type.toUpperCase()} enviado exitosamente:`, filename);
        
        toast({
          title: '✅ Documento enviado',
          description: `${filename} subido correctamente.`,
        });
        
        return true;
      } else {
        console.error(`❌ Error al enviar ${type}:`, response.status, response.statusText);
        // Error al enviar: guardar en cola offline
        return await this.queueForOfflineSync(payload, filename);
      }
    } catch (error) {
      console.error(`❌ Error al enviar documento a webhook:`, error);
      
      // Error: guardar en cola offline para reintento
      const base64 = await this.blobToBase64(file);
      const payload = {
        filename,
        projectName,
        type,
        size: file.size,
        timestamp: new Date().toISOString(),
        data: base64,
        ...metadata
      };
      
      return await this.queueForOfflineSync(payload, filename);
    }
  }

  // Encolar documento para sincronización offline
  private static async queueForOfflineSync(payload: any, filename: string): Promise<boolean> {
    try {
      const localId = uuidv4();
      
      await addToOutbox({
        localId,
        endpoint: this.webhookUrl,
        method: 'POST',
        payload,
        timestamp: Date.now()
      });

      // Intentar registrar sync
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-form-queue');
      } catch (e) {
        console.warn('Background Sync no disponible:', e);
        try {
          const registration = await navigator.serviceWorker.ready;
          registration.active?.postMessage({ type: 'PROCESS_OUTBOX' });
        } catch {}
      }

      const pendingCount = await getPendingCount();
      
      toast({
        title: '💾 Documento guardado localmente',
        description: `${filename} se enviará automáticamente cuando haya conexión. ${pendingCount} documento(s) pendiente(s).`,
      });

      return true;
    } catch (error) {
      console.error('Error queueing document for offline sync:', error);
      
      toast({
        title: '❌ Error al guardar documento',
        description: 'No se pudo guardar el documento localmente',
        variant: 'destructive'
      });
      
      return false;
    }
  }

  // Verificar conexión real usando webhook
  private static async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Usar GET sin cabeceras y no-cors para evitar CORS/preflight
      await fetch('https://n8n.n8n.instalia.synology.me/webhook/Conexion_handler?ping=1', {
        method: 'GET',
        cache: 'no-cache',
        mode: 'no-cors', // Permitir sin CORS configurado
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Con no-cors, si la petición se completó sin error de red, asumimos conexión
      return true;
    } catch {
      return false;
    }
  }

  // Convertir Blob a Base64
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Extraer solo la parte base64 sin el prefijo data:...
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Enviar múltiples documentos de forma asíncrona con límite de concurrencia
  static async uploadMultipleDocuments(documents: UploadDocumentOptions[]): Promise<number> {
    if (!this.hasWebhook()) {
      console.warn('No hay webhook configurado');
      return 0;
    }

    if (documents.length === 0) {
      return 0;
    }

    console.log(`📤 Subiendo ${documents.length} documentos en paralelo...`);

    // Limitar concurrencia a 5 documentos simultáneos para no saturar la red
    const batchSize = 5;
    let successCount = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`📦 Procesando lote ${batchNum}/${totalBatches} (${batch.length} documentos)`);
      
      // Procesar batch en paralelo
      const results = await Promise.allSettled(
        batch.map(doc => this.uploadDocument(doc))
      );

      // Contar éxitos del batch
      const batchSuccess = results.filter(
        result => result.status === 'fulfilled' && result.value === true
      ).length;
      
      successCount += batchSuccess;
      console.log(`✅ Lote ${batchNum}: ${batchSuccess}/${batch.length} exitosos`);

      // Pequeña pausa entre batches
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`✅ Upload completo: ${successCount}/${documents.length} documentos subidos`);
    return successCount;
  }

  // Test de conexión al webhook
  static async testConnection(): Promise<boolean> {
    if (!this.hasWebhook()) {
      toast({
        title: 'Error',
        description: 'No hay webhook configurado',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString()
        }),
      });

      const isOk = response.ok;
      const respText = await response.clone().text().catch(() => '');
      
      toast({
        title: isOk ? 'Conexión exitosa' : 'Error de conexión',
        description: isOk 
          ? `Webhook activo. Respuesta: ${respText || 'OK'}`
          : `Error: ${response.status} ${response.statusText}. Respuesta: ${respText}`,
        variant: isOk ? 'default' : 'destructive',
      });

      return isOk;
    } catch (error) {
      toast({
        title: 'Error de conexión',
        description: error instanceof Error ? error.message : 'No se pudo conectar al webhook',
        variant: 'destructive',
      });
      return false;
    }
  }
}
