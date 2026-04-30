#!/usr/bin/env python3
import os
import re
import glob
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Tuple

COMMAND_DIR = r"C:\Users\eduar\.config\opencode\command"
AGENTS_DIR = r"C:\Users\eduar\.config\opencode\agents"

TRANSLATIONS = {
    "gsd-add-backlog": "Adicionar uma ideia ao backlog (numeração 999.x)",
    "gsd-add-phase": "Adicionar fase ao final do marco atual no roadmap",
    "gsd-add-tests": "Gerar testes para uma fase concluída baseados nos critérios UAT e implementação",
    "gsd-add-todo": "Capturar ideia ou tarefa como todo a partir do contexto da conversa atual",
    "gsd-ai-integration-phase": "Gerar contrato de design de IA (AI-SPEC.md) para fases que envolvem sistemas de IA",
    "gsd-analyze-dependencies": "Analisar dependências de fases e sugerir entradas 'Depends on' para ROADMAP.md",
    "gsd-audit-fix": "Pipeline autônomo de auditoria para correção — encontrar problemas, classificar, corrigir, testar ecommitar",
    "gsd-audit-milestone": "Auditar conclusão do marco contra a intentição original antes de arquivar",
    "gsd-audit-uat": "Auditoria entre fases de todos os itens UAT e verificação pendentes",
    "gsd-autonomous": "Executar todas as fases restantes autonomamente — discutir→planejar→executar por fase",
    "gsd-check-todos": "Listar todos pendentes e selecionar um para trabajar",
    "gsd-cleanup": "Arquivar diretórios de fases acumulados de marcos concluídos",
    "gsd-code-review": "Revisar arquivos fonte alterados durante uma fase em busca de bugs, problemas de segurança e qualidade",
    "gsd-code-review-fix": "Corrigir automaticamente problemas encontrados na revisão de código",
    "gsd-complete-milestone": "Marcar o marco atual como completo e iniciar arquivamento",
    "gsd-debug": "Iniciar sessão de debug interativa para investigar problemas",
    "gsd-discuss-phase": "Discutir uma fase específica para análise aprofundada ou brainstorming",
    "gsd-do": "Executar a próxima fase incompleta do marco atual",
    "gsd-docs-update": "Atualizar documentação importada de fases concluídas",
    "gsd-eval-review": "Revisar a cobertura de avaliação de uma fase implementada",
    "gsd-execute-phase": "Executar uma fase do roadmap (discussão → planejamento → execução)",
    "gsd-explore": "Explorar codebase para entender estrutura, padrões e integrações",
    "gsd-extract_learnings": "Extrair aprendizados de fases concluídas para INGEST-CONFLICTS.md",
    "gsd-fast": "Executar modo rápido — pularDiscussão, langsung para planejamento",
    "gsd-forensics": "Analisar o código changed para entender o que foi feito",
    "gsd-from-gsd2": "Importar projeto do GSD 1.x/2.x para o workspace atual",
    "gsd-graphify": "Gerar visualização de grafo das dependências entre fases",
    "gsd-health": "Verificar saúde do projeto — dependências, segurança, configuração",
    "gsd-help": "Mostrar ajuda interativa com comandos disponíveis",
    "gsd-import": "Importar documentos de planejamento externo para o projeto",
    "gsd-inbox": "Processar caixa de entrada de tarefas pendentes",
    "gsd-ingest-docs": "Ingerir e classificar documentos de planejamento externo",
    "gsd-insert-phase": "Inserir fase em uma posição específica no roadmap",
    "gsd-intel": "Atualizar arquivos de inteligência do projeto",
    "gsd-join-discord": "Convidar usuário para o Discord da comunidade GSD",
    "gsd-list-phase-assumptions": "Listar todas as suposições de fases ativas",
    "gsd-list-workspaces": "Listar workspaces disponíveis",
    "gsd-manager": "Gerenciar execução de múltiplas fases em paralelo",
    "gsd-map-codebase": "Mapear codebase e produzir documentos de análise",
    "gsd-milestone-summary": "Gerar resumo consolidado do marco atual",
    "gsd-new-milestone": "Criar novo marco no roadmap",
    "gsd-new-project": "Criar novo projeto do zero",
    "gsd-new-workspace": "Criar novo workspace",
    "gsd-next": "Mostrar a próxima fase incompleta",
    "gsd-note": "Fazer uma anotação no contexto atual",
    "gsd-pause-work": "Pausar trabajo no projeto atual",
    "gsd-plan-milestone-gaps": "Analisar gaps entre fases do marco atual",
    "gsd-plan-phase": "Planejar uma fase específica",
    "gsd-plan-review-convergence": "Convergir revisões de planejamento para consenso",
    "gsd-plant-seed": "Plantar seed de projeto para bootstrapping",
    "gsd-pr-branch": "Criar e configurar branch de PR para trabalho atual",
    "gsd-profile-user": "Perfil do usuário para personalização de comportamento",
    "gsd-progress": "Mostrar progresso geral do projeto",
    "gsd-quick": "Executar modo rápido — pular discussão, langsung para execução",
    "gsd-reapply-patches": "Reaplicar patches salvos de sessões anteriores",
    "gsd-remove-phase": "Remover fase do roadmap",
    "gsd-remove-workspace": "Remover workspace do sistema",
    "gsd-research-phase": "Executar fase de pesquisa para entender domínio",
    "gsd-resume-work": "Retomar trabalho no projeto anterior",
    "gsd-review": "Revisar progresso e estado do projeto",
    "gsd-review-backlog": "Revisar e promover itens do backlog para marcos ativos",
    "gsd-scan": "Escanear codebase para padrões específicos",
    "gsd-secure-phase": "Executar fase de segurança com auditoria completa",
    "gsd-session-report": "Gerar relatório da sessão atual",
    "gsd-set-profile": "Definir perfil de execução",
    "gsd-settings": "Abrir configurações",
    "gsd-settings-advanced": "Abrir configurações avançadas",
    "gsd-settings-integrations": "Gerenciar integrações",
    "gsd-ship": "Entregar omarco atual — finalizar e limpar",
    "gsd-sketch": "Esboçar implementação inicial de uma fase",
    "gsd-sketch-wrap-up": "Finalizar esboço e promover para execução completa",
    "gsd-spec-phase": "Gerar SPEC.md para uma fase",
    "gsd-spike": "Exploração técnica rápida para entender viabilidade",
    "gsd-spike-wrap-up": "Finalizar exploração e documentar descobertas",
    "gsd-stats": "Mostrar estatísticas do projeto",
    "gsd-sync-skills": "Sincronizar skills do marketplace",
    "gsd-thread": "Listar threads de discussão ativas",
    "gsd-ui-phase": "Executar fase de UI com audit completa",
    "gsd-ui-review": "Revisar implementação de UI",
    "gsd-ultraplan-phase": "Planejar fase com estratégia ultra-pesquisada",
    "gsd-undo": "Desfazer última ação",
    "gsd-update": "Atualizar projeto com as últimas mudanças",
    "gsd-validate-phase": "Executar validação completa de uma fase",
    "gsd-verify-work": "Verificar trabalho completado",
    "gsd-workstreams": "Listar workstreams ativos",
    "gsd-advisor-researcher": "Pesquisar uma decisão de área cinzenta e retornar tabela comparativa estruturada",
    "gsd-ai-researcher": "Pesquisar frameworks e bibliotecas de IA de documentos oficiais",
    "gsd-assumptions-analyzer": "Analisar codebase para suposições e retornar análise estruturada",
    "gsd-code-fixer": "Aplicar correções de problemas encontrados na revisão de código",
    "gsd-code-reviewer": "Revisar arquivos fonte em busca de bugs, problemas de segurança e qualidade",
    "gsd-codebase-mapper": "Explorar codebase e produzir documentos de análise",
    "gsd-debug-session-manager": "Gerenciar sessão de debug com múltiplos ciclos",
    "gsd-debugger": "Investigar bugs usando método científico",
    "gsd-doc-classifier": "Classificar documento de planejamento único e extrair metadados",
    "gsd-doc-synthesizer": "Sintetizar documentos de planejamento classificados em contexto único",
    "gsd-doc-verifier": "Verificar afirmações factuais em documentos gerados contra codebase real",
    "gsd-doc-writer": "Escrever e atualizar documentação do projeto",
    "gsd-domain-researcher": "Pesquisar domínio de aplicação para práticas especializadas",
    "gsd-eval-auditor": "Auditar retroativamente a cobertura de avaliação de uma fase",
    "gsd-eval-planner": " projetar estratégia de avaliação para uma fase",
    "gsd-executor": "Executar planos GSD com commits atômicos",
    "gsd-framework-selector": "Apresentar matriz de decisão para selecionar framework de IA",
    "gsd-integration-checker": "Verificar integração entre fases e fluxos E2E",
    "gsd-intel-updater": "Analisar codebase e escrever arquivos de inteligência",
    "gsd-nyquist-auditor": "Preencher gaps de validação de Nyquist",
    "gsd-pattern-mapper": "Analisar codebase para padrões e mapear para análogos",
    "gsd-phase-researcher": "Pesquisar como implementar uma fase antes do planejamento",
    "gsd-plan-checker": "Verificar qualidade do plano usando análise retrospectiva",
    "gsd-planner": "Criar planos executáveis com breakdown de tarefas",
    "gsd-project-researcher": "Pesquisar ecossistema de domínio antes do roadmap",
    "gsd-research-synthesizer": "Sintetizar saídas de pesquisadores paralelos em SUMARY.md",
    "gsd-roadmapper": "Criar roadmap de projeto com breakdown de fases",
    "gsd-security-auditor": "Verificar que mitigações de ameaças existem no código implementado",
    "gsd-ui-auditor": "Auditoria visual de 6 pilares da UI implementada",
    "gsd-ui-checker": "Validar contratos de design UI-SPEC.md contra 6 dimensões",
    "gsd-ui-researcher": "Produzir contrato de design UI para fases de frontend",
    "gsd-user-profiler": "Analisar mensagens para produzir perfil de desenvolvedor",
    "gsd-verifier": "Verificar achievement da fase usando análise retrospectiva",
}

def extract_description(content: str) -> Tuple[str, str]:
    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    if not match:
        return content, ""
    
    yaml_block = match.group(1)
    desc_match = re.search(r'^description:\s*(.+)$', yaml_block, re.MULTILINE)
    
    if not desc_match:
        return content, ""
    
    original_desc = desc_match.group(1).strip()
    return content, original_desc

def update_description(content: str, new_desc: str, original_desc: str) -> str:
    new_yaml = f'description: {new_desc}'
    if original_desc:
        content = content.replace(
            f'description: {original_desc}',
            new_yaml
        )
    return content

def process_file(file_path: str) -> str:
    filename = os.path.basename(file_path)
    name_without_ext = os.path.splitext(filename)[0]
    
    if name_without_ext in TRANSLATIONS:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content, original = extract_description(content)
        
        if original:
            new_content = update_description(content, TRANSLATIONS[name_without_ext], original)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return f"  [OK] {filename}"
        else:
            return f"  [--] {filename} (sem description)"
    else:
        return f"  [--] {filename} (nao encontrado)"
    
os.chdir("C:/PROJETOS/BED-Site")

print("Traduzindo descrições dos comandos GSD...")
print("-" * 50)

processed = []
all_files = []

for pattern in [os.path.join(COMMAND_DIR, "gsd-*.md"), os.path.join(AGENTS_DIR, "gsd-*.md")]:
    all_files.extend(glob.glob(pattern))

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(process_file, fp): fp for fp in all_files}
    for future in as_completed(futures):
        result = future.result()
        if result and "[OK]" in result:
            processed.append(result)
            print(result)

print("-" * 50)
print(f"Total procesado: {len(processed)}/{len(all_files)}")

for pattern in [os.path.join(COMMAND_DIR, "gsd-*.md"), os.path.join(AGENTS_DIR, "gsd-*.md")]:
    for fp in glob.glob(pattern):
        filename = os.path.basename(fp)
        name = os.path.splitext(filename)[0]
        if name not in TRANSLATIONS:
            print(f"  ? {filename} (falta tradução)")