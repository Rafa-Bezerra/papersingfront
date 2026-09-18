import type { Pagamento } from "@/types/Pagamentos";
import { safeDateLabel, toMoney } from "@/utils/functions";

/** HTML da autorização de pagamento (RH / Impostos) — mesmo layout da tela de Pagamentos. */
export function buildPagamentoAutorizacaoHtml(data: Pagamento): string {
  return `
    <html>
      <head>
        <title>Autorização de Pagamento</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #000; }
          .container { width: 100%; border: 1px solid #000; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding: 10px; }
          .titulo { text-align: center; font-weight: bold; font-size: 18px; flex: 1; }
          .info-topo { font-size: 12px; text-align: right; }
          .linha { border-bottom: 1px solid #000; padding: 6px 10px; font-size: 13px; }
          .historico { padding: 10px; min-height: 60px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { border: 1px solid #000; padding: 6px; }
          .label { font-weight: bold; width: 180px; }
          .valor-final { font-size: 18px; font-weight: bold; text-align: right; padding-right: 20px; }
          .right { text-align: right; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div><img src="/way.jpg" style="width: 120px;" /></div>
            <div class="titulo">Autorização de Pagamento Financeiro</div>
            <div class="info-topo">
              <div><strong>Data/Hora Emissão:</strong></div>
              <div>${new Date().toLocaleString("pt-BR")}</div>
            </div>
          </div>
          <div class="linha">
            <strong>Documento:</strong> ${data.numero_documento}
            &nbsp;&nbsp;&nbsp;
            <strong>Tipo:</strong> ${data.tipo_documento}
          </div>
          <div class="linha">
            <strong>Data de Vencimento:</strong> ${safeDateLabel(data.data_vencimento)}
            &nbsp;&nbsp;&nbsp;
            <strong>Previsão de Baixa:</strong> ${safeDateLabel(data.data_prev_baixa)}
          </div>
          <div class="historico">
            <strong>Histórico do Lançamento:</strong> ${data.historico}
          </div>
          <table>
            <tr>
              <td class="label">Valor Documento</td>
              <td class="right">${toMoney(data.valor_original)}</td>
            </tr>
            <tr>
              <td class="label">Tributos</td>
              <td class="right">${toMoney(data.tributos)}</td>
            </tr>
            <tr>
              <td class="label">Multas</td>
              <td class="right">${toMoney(data.multas)}</td>
            </tr>
            <tr>
              <td class="label">Caução</td>
              <td class="right">${toMoney(data.caucao)}</td>
            </tr>
            <tr>
              <td class="label"><strong>Valor a Ser Pago</strong></td>
              <td class="valor-final">${toMoney(data.valor_liquido)}</td>
            </tr>
          </table>
          <br/><br/>
          <table style="margin-top:30px;">
            <tr>
              <td colspan="3" style="text-align:center; font-weight:bold;">APROVAÇÃO</td>
            </tr>
            <tr>
              <td style="text-align:center; font-weight:bold;">FINANCEIRO</td>
              <td style="text-align:center; font-weight:bold;">CONTROLADORIA</td>
              <td style="text-align:center; font-weight:bold;">DIRETORIA</td>
            </tr>
            <tr>
              <td style="height:100px;"></td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}
