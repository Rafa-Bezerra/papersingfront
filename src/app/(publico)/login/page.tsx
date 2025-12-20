'use client'

import { useRouter } from 'next/navigation'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useState } from 'react'
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
// import { forgotPassword } from '@/services/senhasService'
import Image from "next/image"
import { Eye, EyeOff } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LoginFormValues {
  usuario: string
  password: string
  base: string
}

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    defaultValues: { usuario: '', password: '', base: '' }
  })
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    // setError,
    clearErrors
  } = form
  const router = useRouter()
  // const [showForgotPassword, setShowForgotPassword] = useState(false)
  // const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Função para enviar email de recuperação de senha
  // const handleForgotPassword = async () => {
  //   if (!forgotPasswordEmail) {
  //     alert('Por favor, digite seu email')
  //     return
  //   }

  //   if (!forgotPasswordEmail.includes('@')) {
  //     alert('Por favor, digite um email válido com @ e domínio')
  //     return
  //   }

  //   try {
  //     const response = await forgotPassword(forgotPasswordEmail)
  //     alert(response.message)
  //     setShowForgotPassword(false)
  //     setForgotPasswordEmail('')
  //   } catch (error) {
  //     const message = error instanceof Error ? error.message : 'Erro ao enviar email de recuperação'
  //     alert(message)
  //   }
  // }

  // Função de submit do login simplificada
  const onSubmit: SubmitHandler<LoginFormValues> = async values => {
    try {
      // Validação básica - apenas verificar se os campos não estão vazios
      if (!values.usuario || !values.password) {
        alert('Por favor, preencha todos os campos')
        return;
      }

      // Limpa erros anteriores
      clearErrors()

      // Payload para o backend (corrigido para formato original)
      const payload: LoginPayload = {
        username: values.usuario,
        password: values.password,
        base: values.base
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
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl blur-lg opacity-20"></div>
                <Image
                  src="/papersign-logo.png"
                  alt="Logo PaperSign"
                  width={120}
                  height={120}
                  className="relative h-20 w-auto"
                  unoptimized
                />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-slate-800 dark:text-white">
              Bem-vindo ao{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                PaperSign
              </span>
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 mt-2">
              Faça login na sua conta para continuar
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={control}
                  name="usuario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Usuário
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Digite seu usuário"
                          {...field}
                          className="h-12 border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg"
                        />
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
                      <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Senha
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite sua senha"
                            {...field}
                            className="h-12 pr-12 border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  <FormField
                    control={control}
                    name="base"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a base" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WAY 112">WAY 112</SelectItem>
                              <SelectItem value="WAY 153">WAY 153</SelectItem>
                              <SelectItem value="WAY 262">WAY 262</SelectItem>
                              <SelectItem value="WAY 306">WAY 306</SelectItem>
                              <SelectItem value="WAY 364">WAY 364</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                {/* <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div> */}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Entrando...
                    </div>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Esqueci Senha */}
      {/* {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Recuperar Senha
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Digite seu email para receber instruções de recuperação de senha.
            </p>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={forgotPasswordEmail}
              onChange={(e) => setForgotPasswordEmail(e.target.value)}
              className="mb-6 h-12 border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false)
                  setForgotPasswordEmail('')
                }}
                className="flex-1 h-12 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleForgotPassword} 
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg"
              >
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )} */}
    </main>
  )
}