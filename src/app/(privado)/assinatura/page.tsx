'use client';

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Assinatura, updateAssinatura, get } from "@/services/assinaturaService";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { getTrimmedImage } from "@/utils/functions";

export default function PageAlterarSenha() {    
  const router = useRouter()
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const form = useForm<Assinatura>({
    defaultValues: {
      assinatura: ""
    },
  });

  useEffect(() => {        
    handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSearch() {
    setLoading(true);
    try {      
      const assinaturaBase64 = await get();
      sigCanvas.current?.fromDataURL(`data:image/png;base64,${assinaturaBase64.assinatura}`);
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  
  async function onSubmit() {
    setLoading(true);
    try {
      const assinaturaImage = getTrimmedImage(sigCanvas.current);
      if (!assinaturaImage) {
        toast.error("Por favor, desenhe sua assinatura antes de salvar.");
        setLoading(false);
        return;
      }
      await updateAssinatura({ assinatura: assinaturaImage });
      toast.success("Sucesso!", { description: `Assinatura atualizada!`});
      sigCanvas.current?.clear();
    } catch (err) {
      toast.error((err as Error).message)
    } finally {      
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-2xl font-bold my-6">Alterar senha</CardTitle>
            </CardHeader>

            <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-6 my-6">
              <FormField
                control={form.control}
                name="assinatura"
                render={() => (
                  <FormItem className="col-span-6 flex flex-col">
                    <FormLabel>Assinatura</FormLabel>
                    <div className="border border-gray-300 rounded-lg">
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        canvasProps={{
                          className: "w-full h-48 rounded-lg",
                        }}
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => sigCanvas.current?.clear()}
                      >
                        Limpar
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex justify-end gap-4 my-2">
              <Button
                className="w-22"
                variant="outline"
                type="button"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : "Salvar"}
              </Button>
            </CardFooter>
          </form>
        </Form>
    </Card>
  </div>
  )
}