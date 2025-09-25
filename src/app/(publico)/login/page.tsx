'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, SubmitHandler } from 'react-hook-form'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { login, LoginPayload } from '@/services/auth'

interface LoginFormValues {
  usuario: string
  password: string
}

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    defaultValues: { usuario: '', password: '' }
  })
  const {
    control,
    handleSubmit,
    formState: { isSubmitting }
  } = form
  const router = useRouter()

  const onSubmit: SubmitHandler<LoginFormValues> = async values => {
    try {
      const payload: LoginPayload = {
        username: values.usuario,
        password: values.password
      }
      const usuario = await login(payload)
      
      localStorage.setItem('authToken', usuario.token)
      localStorage.setItem('userData', JSON.stringify(usuario))
      router.push('/home')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na autenticação'
      alert(message)
    }
  }

  return (
    <main className="min-h-screen w-full bg-muted flex items-center justify-center p-4">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-lg">        
        <section className="flex items-center justify-center p-8 md:p-12">
          <Card className="w-full max-w-md border-0 shadow-none">
            <CardHeader className="space-y-6 p-0">
              <div>
                <CardTitle className="text-3xl md:text-4xl leading-tight">
                  Bem-vindo ao{' '}
                  <span className="text-pakistan_green-700">PaperSing</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  Faça login na sua conta para continuar
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="mt-6 p-0">
              <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={control}
                    name="usuario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuário</FormLabel>
                        <FormControl>
                          <Input placeholder="admin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-pakistan_green-600 hover:bg-pakistan_green-700"
                  >
                    {isSubmitting ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
