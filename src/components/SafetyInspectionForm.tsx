import React, { useState, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Upload, Save, Pen } from 'lucide-react';
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
  materialEmpleado: z.string().min(1, 'El material empleado es requerido'),
});

type WorkReportFormData = z.infer<typeof workReportSchema>;

export const SafetyInspectionForm = () => {
  const [signatureType, setSignatureType] = useState<'manual' | 'digital'>('manual');
  const [digitalSignature, setDigitalSignature] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    },
  });

  const handleDigitalSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setDigitalSignature(result);
        toast({
          title: 'Firma cargada',
          description: 'La firma digital se ha cargado correctamente.',
        });
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: 'Error',
        description: 'Por favor, selecciona una imagen válida.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = (data: WorkReportFormData) => {
    // Validar firma
    if (signatureType === 'manual' && !isSignatureSaved) {
      toast({
        title: 'Firma requerida',
        description: 'Por favor, dibuja y guarda tu firma antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (signatureType === 'digital' && !digitalSignature) {
      toast({
        title: 'Firma requerida',
        description: 'Por favor, carga una firma digital antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    const reportData = {
      ...data,
      firma: signatureType === 'manual' ? signatureData : digitalSignature,
      tipoFirma: signatureType,
    };

    console.log('Datos del parte:', reportData);

    toast({
      title: 'Parte guardado',
      description: 'El parte de trabajo se ha guardado correctamente.',
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
                      <FormControl>
                        <Input placeholder="Nombre del operario" {...field} />
                      </FormControl>
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
                        <Input placeholder="Nombre de la obra" {...field} />
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
                      <FormLabel>Material empleado</FormLabel>
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

                {/* Firma */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Firma</Label>
                  <Tabs value={signatureType} onValueChange={(value) => setSignatureType(value as 'manual' | 'digital')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">
                        <Pen className="w-4 h-4 mr-2" />
                        Firma Manual
                      </TabsTrigger>
                      <TabsTrigger value="digital">
                        <Upload className="w-4 h-4 mr-2" />
                        Firma Digital
                      </TabsTrigger>
                    </TabsList>

                    {/* Firma Manual */}
                    <TabsContent value="manual" className="space-y-4">
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
                    </TabsContent>

                    {/* Firma Digital */}
                    <TabsContent value="digital" className="space-y-4">
                      <div className="border-2 border-border rounded-lg p-4 bg-card">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleDigitalSignatureUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Cargar firma desde archivo
                        </Button>
                        {digitalSignature && (
                          <div className="mt-4">
                            <img
                              src={digitalSignature}
                              alt="Firma digital"
                              className="max-h-32 mx-auto border border-border rounded"
                            />
                            <p className="text-sm text-green-600 mt-2 text-center">
                              ✓ Firma cargada correctamente
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
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
