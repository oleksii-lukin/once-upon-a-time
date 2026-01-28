'use client'

import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  Example,
  ExampleWrapper,
} from '@/components/example'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import Image from 'next/image'
import { PlusIcon, BluetoothIcon, MoreVerticalIcon, FileIcon, FolderIcon, FolderOpenIcon, FileCodeIcon, MoreHorizontalIcon, FolderSearchIcon, SaveIcon, DownloadIcon, EyeIcon, LayoutIcon, PaletteIcon, SunIcon, MoonIcon, MonitorIcon, UserIcon, CreditCardIcon, SettingsIcon, KeyboardIcon, LanguagesIcon, BellIcon, MailIcon, ShieldIcon, HelpCircleIcon, FileTextIcon, LogOutIcon } from 'lucide-react'

export function ComponentExample() {
  return (
    <ExampleWrapper>
      <CardExample />
      <FormExample />
    </ExampleWrapper>
  )
}

function CardExample() {
  const { t } = useTranslation()

  return (
    <Example title={t('tw_examples.card.title') || 'Card'} className="items-center justify-center">
      <Card className="relative w-full max-w-sm overflow-hidden pt-0">
        <div className="bg-primary absolute inset-0 z-30 aspect-video opacity-50 mix-blend-color" />
        <Image
          src="https://images.unsplash.com/photo-1604076850742-4c7221f3101b?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt={t('tw_examples.card.photo_by_mymind')}
          title={t('tw_examples.card.photo_by_mymind')}
          className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale"
          fill
        />
        <CardHeader>
          <CardTitle>{t('tw_examples.card.card_title') || 'Observability Plus is replacing Monitoring'}</CardTitle>
          <CardDescription>
            {t('tw_examples.card.card_description') || 'Switch to the improved way to explore your data, with natural language. Monitoring will no longer be available on the Pro plan in November, 2025'}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <PlusIcon data-icon="inline-start" />
                {t('tw_examples.card.show_dialog') || 'Show Dialog'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <BluetoothIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>{t('tw_examples.card.allow_connect_title') || 'Allow accessory to connect?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('tw_examples.card.allow_connect_description') || 'Do you want to allow the USB accessory to connect to this device?'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('tw_examples.card.dont_allow') || 'Don\'t allow'}</AlertDialogCancel>
                <AlertDialogAction>{t('tw_examples.card.allow') || 'Allow'}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Badge variant="secondary" className="ml-auto">
            {t('tw_examples.card.warning') || 'Warning'}
          </Badge>
        </CardFooter>
      </Card>
    </Example>
  )
}

const frameworks = [
  'Next.js',
  'SvelteKit',
  'Nuxt.js',
  'Remix',
  'Astro',
] as const

function FormExample() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = React.useState({
    email: true,
    sms: false,
    push: true,
  })
  const [theme, setTheme] = React.useState('light')

  return (
    <Example title={t('tw_examples.form.title') || 'Form'}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('tw_examples.form.user_info_title') || 'User Information'}</CardTitle>
          <CardDescription>{t('tw_examples.form.user_info_description') || 'Please fill in your details below'}</CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVerticalIcon />
                  <span className="sr-only">{t('tw_examples.form.more_options') || 'More options'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('tw_examples.form.file') || 'File'}</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <FileIcon />
                    {t('tw_examples.form.new') || 'New'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_new') || '⌘N'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FolderIcon />
                    {t('tw_examples.form.new') || 'New'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_new_folder') || '⇧⌘N'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderOpenIcon />
                      {t('tw_examples.form.open_recent') || 'Open Recent'}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>{t('tw_examples.form.recent_projects') || 'Recent Projects'}</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <FileCodeIcon />
                            {t('tw_examples.form.project_alpha') || 'Project Alpha'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileCodeIcon />
                            {t('tw_examples.form.project_beta') || 'Project Beta'}
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <MoreHorizontalIcon />
                              {t('tw_examples.form.more_projects') || 'More Projects'}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem>
                                  <FileCodeIcon />
                                  {t('tw_examples.form.project_gamma') || 'Project Gamma'}
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileCodeIcon />
                                  {t('tw_examples.form.project_delta') || 'Project Delta'}
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem>
                            <FolderSearchIcon />
                            {t('tw_examples.form.browse') || 'Browse...'}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <SaveIcon />
                    {t('tw_examples.form.save') || 'Save'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_save') || '⌘S'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <DownloadIcon />
                    {t('tw_examples.form.export') || 'Export'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_export') || '⇧⌘E'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('tw_examples.form.view') || 'View'}</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={notifications.email}
                    onCheckedChange={checked =>
                      setNotifications({
                        ...notifications,
                        email: checked === true,
                      })}
                  >
                    <EyeIcon />
                    {t('tw_examples.form.show_sidebar') || 'Show Sidebar'}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={notifications.sms}
                    onCheckedChange={checked =>
                      setNotifications({
                        ...notifications,
                        sms: checked === true,
                      })}
                  >
                    <LayoutIcon />
                    {t('tw_examples.form.show_status_bar') || 'Show Status Bar'}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <PaletteIcon />
                      {t('tw_examples.form.theme') || 'Theme'}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>{t('tw_examples.form.appearance') || 'Appearance'}</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={theme}
                            onValueChange={setTheme}
                          >
                            <DropdownMenuRadioItem value="light">
                              <SunIcon />
                              {t('tw_examples.form.light') || 'Light'}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">
                              <MoonIcon />
                              {t('tw_examples.form.dark') || 'Dark'}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="system">
                              <MonitorIcon />
                              {t('tw_examples.form.system') || 'System'}
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('tw_examples.form.account') || 'Account'}</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <UserIcon />
                    {t('tw_examples.form.profile') || 'Profile'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_profile') || '⇧⌘P'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCardIcon />
                    {t('tw_examples.form.billing') || 'Billing'}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <SettingsIcon />
                      {t('tw_examples.form.settings') || 'Settings'}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>{t('tw_examples.form.preferences') || 'Preferences'}</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <KeyboardIcon />
                            {t('tw_examples.form.keyboard_shortcuts') || 'Keyboard Shortcuts'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <LanguagesIcon />
                            {t('tw_examples.form.language') || 'Language'}
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <BellIcon />
                              {t('tw_examples.form.notifications') || 'Notifications'}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel>
                                    {t('tw_examples.form.notification_types') || 'Notification Types'}
                                  </DropdownMenuLabel>
                                  <DropdownMenuCheckboxItem
                                    checked={notifications.push}
                                    onCheckedChange={checked =>
                                      setNotifications({
                                        ...notifications,
                                        push: checked === true,
                                      })}
                                  >
                                    <BellIcon />
                                    {t('tw_examples.form.push_notifications') || 'Push Notifications'}
                                  </DropdownMenuCheckboxItem>
                                  <DropdownMenuCheckboxItem
                                    checked={notifications.email}
                                    onCheckedChange={checked =>
                                      setNotifications({
                                        ...notifications,
                                        email: checked === true,
                                      })}
                                  >
                                    <MailIcon />
                                    {t('tw_examples.form.email_notifications') || 'Email Notifications'}
                                  </DropdownMenuCheckboxItem>
                                </DropdownMenuGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem>
                            <ShieldIcon />
                            {t('tw_examples.form.privacy_security') || 'Privacy & Security'}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <HelpCircleIcon />
                    {t('tw_examples.form.help_support') || 'Help & Support'}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileTextIcon />
                    {t('tw_examples.form.documentation') || 'Documentation'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">
                    <LogOutIcon />
                    {t('tw_examples.form.sign_out') || 'Sign Out'}
                    <DropdownMenuShortcut>{t('tw_examples.form.shortcut_sign_out') || '⇧⌘Q'}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="form-email-notifs">{t('tw_examples.form.email_notifications') || 'Email notifications'}</FieldLabel>
                  <Switch
                    id="form-email-notifs"
                    checked={notifications.email}
                    onCheckedChange={() =>
                      setNotifications({
                        ...notifications,
                        email: !notifications.email,
                      })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="small-form-name">{t('tw_examples.form.name') || 'Name'}</FieldLabel>
                  <Input
                    id="small-form-name"
                    placeholder={t('tw_examples.form.name_placeholder') || 'Enter your name'}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="small-form-role">{t('tw_examples.form.role') || 'Role'}</FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger id="small-form-role">
                      <SelectValue placeholder={t('tw_examples.form.role_placeholder') || 'Select a role'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="developer">{t('tw_examples.form.developer') || 'Developer'}</SelectItem>
                        <SelectItem value="designer">{t('tw_examples.form.designer') || 'Designer'}</SelectItem>
                        <SelectItem value="manager">{t('tw_examples.form.manager') || 'Manager'}</SelectItem>
                        <SelectItem value="other">{t('tw_examples.form.other') || 'Other'}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="small-form-framework">
                  {t('tw_examples.form.framework') || 'Framework'}
                </FieldLabel>
                <Combobox items={frameworks}>
                  <ComboboxInput
                    id="small-form-framework"
                    placeholder={t('tw_examples.form.framework_placeholder') || 'Select a framework'}
                    required
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>{t('tw_examples.form.no_frameworks_found') || 'No frameworks found.'}</ComboboxEmpty>
                    <ComboboxList>
                      {item => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel htmlFor="small-form-comments">{t('tw_examples.form.comments') || 'Comments'}</FieldLabel>
                <Textarea
                  id="small-form-comments"
                  placeholder={t('tw_examples.form.comments_placeholder') || 'Add any additional comments'}
                />
              </Field>
              <Field orientation="horizontal">
                <Button type="submit">{t('tw_examples.form.submit') || 'Submit'}</Button>
                <Button variant="outline" type="button">
                  {t('tw_examples.form.cancel') || 'Cancel'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </Example>
  )
}
