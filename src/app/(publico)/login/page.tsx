'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, SubmitHandler } from 'react-hook-form'
import { Suspense, useEffect, useState } from 'react'
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
import {
  getSamlStatus,
  login,
  LoginPayload,
  SamlStatus,
  startMicrosoftLogin
} from '@/services/auth'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LoginFormValues {
  usuario: string
  password: string
  base: string
}

function LoginPageInner() {
  const form = useForm<LoginFormValues>({
    defaultValues: { usuario: '', password: '', base: '' }
  })
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
    clearErrors
  } = form
  const router = useRouter()
  const search = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [saml, setSaml] = useState<SamlStatus>({
    enabled: false,
    requireMicrosoftLogin: false
  })
  const [ssoBusy, setSsoBusy] = useState(false)
  const baseSelecionada = watch('base')
  const soMicrosoft = saml.enabled && saml.requireMicrosoftLogin

  useEffect(() => {
    const err = search.get('sso_error')
    if (err) alert(err)
    getSamlStatus()
      .then(setSaml)
      .catch(() => setSaml({ enabled: false, requireMicrosoftLogin: false }))
  }, [search])

  const onSubmit: SubmitHandler<LoginFormValues> = async values => {
    try {
      if (soMicrosoft) {
        alert('Use Entrar com Microsoft para acessar o PaperSign.')
        return
      }
      if (!values.usuario || !values.password) {
        alert('Por favor, preencha todos os campos')
        return
      }

      clearErrors()

      const payload: LoginPayload = {
        username: values.usuario,
        password: values.password,
        base: values.base
      }

      const usuario = await login(payload)

      sessionStorage.setItem('authToken', usuario.token)
      sessionStorage.setItem('userData', JSON.stringify(usuario))
      router.push('/home/')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na autenticação'
      alert(message)
    }
  }

  const onMicrosoft = () => {
    const base = (baseSelecionada || '').trim()
    if (!base) {
      alert('Selecione a base antes de entrar com Microsoft.')
      return
    }
    setSsoBusy(true)
    startMicrosoftLogin(base)
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
              {soMicrosoft
                ? 'Acesse com sua conta Microsoft (Active Directory)'
                : 'Faça login na sua conta para continuar'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {!soMicrosoft && (
                  <>
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
                                type={showPassword ? 'text' : 'password'}
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
                  </>
                )}

                <FormField
                  control={control}
                  name="base"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => {
                          field.onChange(v)
                          setValue('base', v, { shouldDirty: true, shouldValidate: true })
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a base" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[200]">
                          <SelectItem value="WAY 112">WAY 112</SelectItem>
                          <SelectItem value="WAY 153">WAY 153</SelectItem>
                          <SelectItem value="WAY 262">WAY 262</SelectItem>
                          <SelectItem value="WAY 306">WAY 306</SelectItem>
                          <SelectItem value="WAY 364">WAY 364</SelectItem>
                          <SelectItem value="WAY CSC">WAY CSC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!soMicrosoft && (
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
                )}

                {saml.enabled && (
                  <>
                    {!soMicrosoft && (
                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-slate-200 dark:border-slate-600" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white/80 dark:bg-slate-800/80 px-2 text-slate-500">
                            ou
                          </span>
                        </div>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant={soMicrosoft ? 'default' : 'outline'}
                      disabled={ssoBusy || !baseSelecionada}
                      onClick={onMicrosoft}
                      className={
                        soMicrosoft
                          ? 'w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg'
                          : 'w-full h-12 rounded-lg border-slate-300'
                      }
                    >
                      {ssoBusy
                        ? 'Redirecionando...'
                        : !baseSelecionada
                          ? 'Selecione a base para Microsoft'
                          : 'Entrar com Microsoft'}
                    </Button>
                  </>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginPageInner />
    </Suspense>
  )
}
