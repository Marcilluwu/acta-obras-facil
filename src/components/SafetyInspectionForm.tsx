import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import SignatureCanvas from 'react-signature-canvas';
import { useSignature } from '@/hooks/useSingature';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Tipos de trabajo en orden alfabético
const workTypes = [
  'Albañilería',
  'Clima',
  'Contraincendios',
  'Electricidad',
  'Fontanería',
  'Mantenimiento',
  'Ventilación',
] as const;

// Schema de validación
const workReportSchema = z.object({
  operario: z.string().min(1, 'El operario es requerido'),
  obra: z.string().min(1, 'La obra es requerida'),
  fecha: z.date({
    required_error: 'La fecha es requerida',
  }),
  horas: z.number().min(0, 'Las horas deben ser positivas').max(24, 'Las horas no pueden exceder 24'),
  tipoTrabajo: z.enum(workTypes, {
    required_error: 'El tipo de trabajo es requerido',
  }),
  numeroOrden: z.string().min(1, 'El número de orden es requerido'),
  trabajoRealizado: z.string().min(1, 'El trabajo realizado es requerido'),
  vehiculo: z.string().min(1, 'El vehículo es requerido'),
  materialEmpleado: z.string().optional(),
  notas: z.string().optional(),
});

type WorkReportFormData = z.infer<typeof workReportSchema>;

export const SafetyInspectionForm = () => {
  const [obras, setObras] = useState<string[]>([]);
  const [showObrasSuggestions, setShowObrasSuggestions] = useState(false);
  const [isSearchingObras, setIsSearchingObras] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const obraInputRef = useRef<HTMLDivElement>(null);
  
  const [operarios, setOperarios] = useState<string[]>([]);
  
  const [logoUrl, setLogoUrl] = useState<string>('');

  // Hook de firma manual
  const {
    signatureRef,
    signatureData,
    isSignatureSaved,
    clearSignature,
    saveSignature,
  } = useSignature({
    onSignatureSave: (signature) => {
      console.log('Firma guardada:', signature);
    },
  });

  // Formulario con React Hook Form
  const form = useForm<WorkReportFormData>({
    resolver: zodResolver(workReportSchema),
    defaultValues: {
      operario: '',
      obra: '',
      horas: 0,
      numeroOrden: '',
      trabajoRealizado: '',
      vehiculo: '',
      materialEmpleado: '',
      notas: '',
    },
  });

  // Cargar logo y operarios al montar el componente
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch(
          'https://n8n.n8n.instalia.synology.me/webhook/logo_ingeman',
          {
            headers: {
              'psswd': '73862137816273861283dhvhfgdvgf27384rtfgcuyefgc7ewufgqwsdafsdf'
            }
          }
        );
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setLogoUrl(imageUrl);
      } catch (error) {
        console.error('Error cargando logo:', error);
      }
    };
    
    const loadOperarios = async () => {
      try {
        const response = await fetch(
          'https://n8n.n8n.instalia.synology.me/webhook/Operarios_Ingeman',
          {
            headers: {
              'psswd': '73862137816273861283dhvhfgdvgf27384rtfgcuyefgc7ewufgqwsdafsdf'
            }
          }
        );
        const data = await response.json();
        
        console.log('Lista completa de operarios:', data);
        
        let operariosList: string[] = [];
        
        if (Array.isArray(data)) {
          operariosList = data.map((item: any) => 
            typeof item === 'string' ? item : item.nombre || item.operario || item.toString()
          );
        } else if (typeof data === 'object' && data !== null) {
          const possibleArrays = Object.values(data).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            operariosList = possibleArrays[0].map((item: any) => 
              typeof item === 'string' ? item : item.nombre || item.operario || item.toString()
            );
          }
        } else if (typeof data === 'string') {
          operariosList = [data];
        }
        
        setOperarios(operariosList);
      } catch (error) {
        console.error('Error cargando operarios:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los operarios',
          variant: 'destructive',
        });
      }
    };
    
    loadLogo();
    loadOperarios();
  }, []);

  // Buscar obras en el webhook
  const searchObras = async (query: string) => {
    if (query.length < 2) {
      setObras([]);
      setShowObrasSuggestions(false);
      return;
    }

    setIsSearchingObras(true);
    try {
      const response = await fetch(
        `https://n8n.n8n.instalia.synology.me/webhook/Obras_Ingeman?busqueda=${encodeURIComponent(query)}`,
        {
          headers: {
            'psswd': '73862137816273861283dhvhfgdvgf27384rtfgcuyefgc7ewufgqwsdafsdf'
          }
        }
      );
      const data = await response.json();
      
      console.log('Respuesta del webhook obras:', data);
      
      let obrasList: string[] = [];
      
      if (Array.isArray(data)) {
        obrasList = data.map((item: any) => 
          typeof item === 'string' ? item : item.nombre || item.obra || item.toString()
        );
      } else if (typeof data === 'object' && data !== null) {
        const possibleArrays = Object.values(data).filter(Array.isArray);
        if (possibleArrays.length > 0) {
          obrasList = possibleArrays[0].map((item: any) => 
            typeof item === 'string' ? item : item.nombre || item.obra || item.toString()
          );
        }
      } else if (typeof data === 'string') {
        obrasList = [data];
      }
      
      setObras(obrasList);
      setShowObrasSuggestions(true);
    } catch (error) {
      console.error('Error buscando obras:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las obras',
        variant: 'destructive',
      });
      setObras([]);
      setShowObrasSuggestions(false);
    } finally {
      setIsSearchingObras(false);
    }
  };


  // Debounce para la búsqueda de obras
  const handleObraInputChange = (value: string, onChange: (value: string) => void) => {
    onChange(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchObras(value);
    }, 300);
  };


  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (obraInputRef.current && !obraInputRef.current.contains(event.target as Node)) {
        setShowObrasSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onSubmit = async (data: WorkReportFormData) => {
    // Validar firma
    if (!isSignatureSaved) {
      toast({
        title: 'Firma requerida',
        description: 'Por favor, dibuja y guarda tu firma antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: 'Generando documentos...',
        description: 'Creando PDF y DOCX del parte de trabajo',
      });

      // Generar nombre de archivo con formato: YYMMdd_NºOrden Nombre Obra.Parte
      const year = data.fecha.getFullYear().toString().slice(-2);
      const month = String(data.fecha.getMonth() + 1).padStart(2, '0');
      const day = String(data.fecha.getDate()).padStart(2, '0');
      const baseFilename = `${year}${month}${day}_${data.numeroOrden} ${data.obra}.Parte`;

      // Generar PDF y DOCX
      const { generateParteDocuments } = await import('@/utils/parteGenerator');
      const result = await generateParteDocuments({
        operario: data.operario,
        obra: data.obra,
        fecha: data.fecha,
        horas: data.horas,
        tipoTrabajo: data.tipoTrabajo,
        numeroOrden: data.numeroOrden,
        trabajoRealizado: data.trabajoRealizado,
        vehiculo: data.vehiculo,
        materialEmpleado: data.materialEmpleado,
        notas: data.notas,
        firma: signatureData!,
        logoUrl,
        baseFilename
      });

      if (result.success) {
        // Enviar documentos al webhook
        const { WebhookApi } = await import('@/services/webhookApi');
        
        const uploadPromises = [];
        
        if (result.pdfBlob) {
          uploadPromises.push(
            WebhookApi.uploadDocument({
              file: result.pdfBlob,
              filename: `${baseFilename}.pdf`,
              projectName: data.obra,
              type: 'pdf'
            })
          );
        }
        
        if (result.docxBlob) {
          uploadPromises.push(
            WebhookApi.uploadDocument({
              file: result.docxBlob,
              filename: `${baseFilename}.docx`,
              projectName: data.obra,
              type: 'docx'
            })
          );
        }

        await Promise.all(uploadPromises);

        toast({
          title: 'Parte guardado',
          description: 'Los documentos se han generado y enviado correctamente.',
        });

        // Limpiar formulario
        form.reset();
        clearSignature();
      }
    } catch (error) {
      console.error('Error generando documentos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron generar los documentos',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {logoUrl && (
          <div className="flex justify-center mb-6">
            <img src={logoUrl} alt="Logo de la empresa" className="h-32 object-contain" />
          </div>
        )}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Parte de Trabajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Operario */}
                <FormField
                  control={form.control}
                  name="operario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operario</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un operario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {operarios.map((operario, index) => (
                            <SelectItem key={index} value={operario}>
                              {operario}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Obra */}
                <FormField
                  control={form.control}
                  name="obra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obra</FormLabel>
                      <FormControl>
                        <div ref={obraInputRef} className="relative">
                          <Input
                            placeholder="Escribe para buscar obra..."
                            value={field.value}
                            onChange={(e) => handleObraInputChange(e.target.value, field.onChange)}
                            onFocus={() => {
                              if (obras.length > 0) {
                                setShowObrasSuggestions(true);
                              }
                            }}
                          />
                          {isSearchingObras && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                          )}
                          {showObrasSuggestions && obras.length > 0 && (
                            <div className="absolute z-[100] w-full mt-2 bg-popover border-2 border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                              <div className="p-2 text-xs text-muted-foreground border-b border-border">
                                {obras.length} resultado{obras.length !== 1 ? 's' : ''} encontrado{obras.length !== 1 ? 's' : ''}
                              </div>
                              {obras.map((obra, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full px-4 py-3 text-left hover:bg-accent focus:bg-accent transition-colors border-b border-border last:border-b-0"
                                  onClick={() => {
                                    field.onChange(obra);
                                    setShowObrasSuggestions(false);
                                  }}
                                >
                                  <div className="font-medium">{obra}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fecha */}
                <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP', { locale: es })
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date('1900-01-01')
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Horas */}
                <FormField
                  control={form.control}
                  name="horas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de trabajo */}
                <FormField
                  control={form.control}
                  name="tipoTrabajo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de trabajo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el tipo de trabajo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card z-50">
                          {workTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número de orden */}
                <FormField
                  control={form.control}
                  name="numeroOrden"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de orden de trabajo, PDS, etc.</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de orden" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Trabajo realizado */}
                <FormField
                  control={form.control}
                  name="trabajoRealizado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trabajo realizado</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el trabajo realizado..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vehículo utilizado */}
                <FormField
                  control={form.control}
                  name="vehiculo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehículo utilizado</FormLabel>
                      <FormControl>
                        <Input placeholder="Matrícula o identificación del vehículo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Material empleado */}
                <FormField
                  control={form.control}
                  name="materialEmpleado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material empleado (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el material empleado..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notas */}
                <FormField
                  control={form.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas adicionales (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Añade notas adicionales sobre el trabajo..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Firma */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Firma</Label>
                  <div className="border-2 border-border rounded-lg p-4 bg-card">
                    <div className="border border-border rounded-md bg-background">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          className: 'w-full h-48 touch-none',
                        }}
                        backgroundColor="white"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearSignature}
                        className="flex-1"
                      >
                        Limpiar
                      </Button>
                      <Button
                        type="button"
                        onClick={saveSignature}
                        className="flex-1"
                      >
                        Guardar Firma
                      </Button>
                    </div>
                    {isSignatureSaved && (
                      <p className="text-sm text-green-600 mt-2 text-center">
                        ✓ Firma guardada correctamente
                      </p>
                    )}
                  </div>
                </div>

                {/* Botón de guardar */}
                <div className="pt-4">
                  <Button type="submit" className="w-full" size="lg">
                    <Save className="w-5 h-5 mr-2" />
                    Guardar Parte de Trabajo
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
