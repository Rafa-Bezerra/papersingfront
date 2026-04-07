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
import { updateEmail } from "@/services/senhasService";
import { toast } from "sonner";

interface AlterarEmailForm {
    novo_email: string;
    confirmacao_email: string;
}

export default function PageAlterarEmail() {
    const router = useRouter()
    const [loading, setLoading] = useState(false);

    const form = useForm<AlterarEmailForm>({
        defaultValues: {
            novo_email: "",
            confirmacao_email: "",
        },
    });

    async function onSubmit(data: AlterarEmailForm) {
        if (data.novo_email !== data.confirmacao_email) {
            form.setError("confirmacao_email", {
                type: "manual",
                message: "Os e-mails não coincidem",
            });
            return;
        }

        setLoading(true);
        try {
            await updateEmail(data.novo_email);
            toast.success("E-mail atualizado com sucesso!");
            form.reset();
        } catch (err) {
            toast.error((err as Error).message);
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
                            <CardTitle className="text-2xl font-bold my-6">Alterar e-mail</CardTitle>
                        </CardHeader>

                        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-6 my-6">

                        <FormField
                            control={form.control}
                            name="novo_email"
                            rules={{
                                required: "Novo e-mail é obrigatório",
                                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "E-mail inválido" }
                            }}
                            render={({ field }) => (
                            <FormItem className="col-span-6 md:col-span-3">
                                <FormLabel>Novo e-mail</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="novo@email.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="confirmacao_email"
                            rules={{ required: "Confirmação de e-mail é obrigatória" }}
                            render={({ field }) => (
                            <FormItem className="col-span-6 md:col-span-3">
                                <FormLabel>Confirmar e-mail</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="novo@email.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        </CardContent>

                        <CardFooter className="flex justify-end gap-4 my-2">
                        <Button
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
