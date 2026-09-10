'use client'

import React, { useEffect, useId, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  criarFornecedorParceiro,
  FornecedorParceiroResult,
} from '@/services/docusignService'

export type FornecedorParceiroPrefill = {
  nome?: string
  email?: string
}

function splitNome(nome?: string): { primeiro: string; ultimo: string } {
  const parts = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { primeiro: '', ultimo: '' }
  if (parts.length === 1) return { primeiro: parts[0], ultimo: '' }
  return { primeiro: parts[0], ultimo: parts.slice(1).join(' ') }
}

export default function FornecedorParceiroPanel({
  prefill,
}: {
  prefill?: FornecedorParceiroPrefill | null
}) {
  const formId = useId()
  const [primeiroNome, setPrimeiroNome] = useState('')
  const [ultimoNome, setUltimoNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [cpf, setCpf] = useState('')
  const [endereco, setEndereco] = useState('')
  const [resultado, setResultado] = useState<FornecedorParceiroResult | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!prefill) return
    const { primeiro, ultimo } = splitNome(prefill.nome)
    if (primeiro) setPrimeiroNome(primeiro)
    if (ultimo) setUltimoNome(ultimo)
    if (prefill.email?.trim()) setEmail(prefill.email.trim())
  }, [prefill])

  function limpar() {
    setPrimeiroNome('')
    setUltimoNome('')
    setEmail('')
    setTelefone('')
    setNascimento('')
    setCpf('')
    setEndereco('')
  }

  function handleCriar() {
    if (!primeiroNome.trim()) {
      toast.error('Informe o primeiro nome.')
      return
    }
    if (!email.trim()) {
      toast.error('Informe o e-mail.')
      return
    }

    startTransition(async () => {
      try {
        const res = await criarFornecedorParceiro({
          primeiroNome: primeiroNome.trim(),
          ultimoNome: ultimoNome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || undefined,
          nascimento: nascimento || undefined,
          cpf: cpf.trim() || undefined,
          endereco: endereco.trim() || undefined,
        })
        setResultado(res)
        toast.success(res.message)
        limpar()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao criar conta.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold">Fornecedor / parceiro</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cria conta na PlugSign (e-mail de acesso) e espelha no painel externo PaperSign.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button type="button" variant="secondary" disabled={isPending} onClick={limpar}>
              Limpar
            </Button>
            <Button type="button" disabled={isPending} onClick={handleCriar}>
              {isPending ? 'Criando…' : 'Criar conta'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`${formId}-pn`} className="text-xs">
                Primeiro nome
              </Label>
              <Input
                id={`${formId}-pn`}
                className="h-8"
                value={primeiroNome}
                onChange={(e) => setPrimeiroNome(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-un`} className="text-xs">
                Último nome
              </Label>
              <Input
                id={`${formId}-un`}
                className="h-8"
                value={ultimoNome}
                onChange={(e) => setUltimoNome(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-email`} className="text-xs">
                E-mail
              </Label>
              <Input
                id={`${formId}-email`}
                type="email"
                className="h-8"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-tel`} className="text-xs">
                Telefone
              </Label>
              <Input
                id={`${formId}-tel`}
                className="h-8"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={isPending}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-nasc`} className="text-xs">
                Nascimento
              </Label>
              <Input
                id={`${formId}-nasc`}
                type="date"
                className="h-8"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-cpf`} className="text-xs">
                C.P.F
              </Label>
              <Input
                id={`${formId}-cpf`}
                className="h-8"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                disabled={isPending}
                placeholder="Ex: 654.987.321-55"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor={`${formId}-end`} className="text-xs">
                Endereço
              </Label>
              <Input
                id={`${formId}-end`}
                className="h-8"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pt-0">
            <p>{resultado.message}</p>
            <p className="text-muted-foreground text-xs">
              PlugSign: {resultado.plugSign?.name} {resultado.plugSign?.lastName} —{' '}
              {resultado.plugSign?.email}
            </p>
            {resultado.paperSign && (
              <div className="rounded-md border p-2.5 space-y-1 text-xs">
                <p className="font-medium text-sm">Painel externo PaperSign</p>
                <p>Usuário: {resultado.paperSign.usuario}</p>
                <p>Senha temporária: {resultado.paperSign.senhaTemporaria}</p>
                <p className="text-muted-foreground">{resultado.paperSign.aviso}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
