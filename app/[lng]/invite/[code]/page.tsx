import InviteHandler from '@/components/lobby/InviteHandler'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string, lng: string }>
}) {
  const { code, lng } = await params

  return <InviteHandler code={code} lng={lng} />
}
