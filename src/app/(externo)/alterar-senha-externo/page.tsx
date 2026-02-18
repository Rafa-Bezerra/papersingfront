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
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AlterarSenha, updateSenhaExterno } from "@/services/senhasService";
import { toast } from "sonner";

export default function PageAlterarSenha() {    
    const router = useRouter()
    const [loading, setLoading] = useState(false);

    const form = useForm<AlterarSenha>({
        defaultValues: {
            senha: "",
            nova_senha: "",
            confirmacao_senha: ""
        },
    });
    
    async function onSubmit(data: AlterarSenha) {
        const { senha, nova_senha, confirmacao_senha } = data;

        if (nova_senha !== confirmacao_senha) {
            form.setError("confirmacao_senha", {
                type: "manual",
                message: "A nova senha e a confirmação devem ser iguais",
            });
            return;
        }

        if (nova_senha === senha) {
            form.setError("nova_senha", {
                type: "manual",
                message: "A nova senha deve ser diferente da senha atual",
            });
            return;
        }

        setLoading(true);
        try {
            await updateSenhaExterno(data);
        // redireciona ou mostra mensagem de sucesso se necessário
        } catch (err) {
            console.error(err);
        } finally {
            if (toast.success) {
                toast.success?.("Sucesso!", {
                    description: `Senha atualizada.`,
                });
            }
            form.reset();
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
                        
                        {/* Senha atual */}
                        <FormField
                            control={form.control}
                            name="senha"
                            rules={{ required: "Senha atual é obrigatória" }}
                            render={({ field }) => (
                            <FormItem className="col-span-6 md:col-span-2">
                                <FormLabel>Senha atual</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        {/* Nova senha */}
                        <FormField
                            control={form.control}
                            name="nova_senha"
                            rules={{ required: "Nova senha é obrigatória" }}
                            render={({ field }) => (
                            <FormItem className="col-span-6 md:col-span-2">
                                <FormLabel>Nova senha</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        {/* Confirmação de senha */}
                        <FormField
                            control={form.control}
                            name="confirmacao_senha"
                            rules={{ required: "Confirmação de senha é obrigatória" }}
                            render={({ field }) => (
                            <FormItem className="col-span-6 md:col-span-2">
                                <FormLabel>Confirmação de senha</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
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