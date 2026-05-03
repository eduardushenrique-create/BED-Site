'use client'

import { useRouter } from 'next/navigation'
import CampaignForm from '../CampaignForm'

export default function NovaCampanhaPage() {
  const router = useRouter()
  return <CampaignForm onSaved={c => router.push(`/admin/emails/campanhas/${c.id}`)} />
}
