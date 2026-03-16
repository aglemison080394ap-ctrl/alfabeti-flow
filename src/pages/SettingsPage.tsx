import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Save, School, Shield, CalendarDays, Plus, Pencil, Trash2, Eye,
  EyeOff, RefreshCw, User, Mail, Lock, X, Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { profile, user } = useAuth();

  // ── School info ──────────────────────────────────────────────────────────
  const [schoolName, setSchoolName]             = useState('');
  const [schoolAddress, setSchoolAddress]       = useState('');
  const [schoolCity, setSchoolCity]             = useState('');
  const [activeSchoolYear, setActiveSchoolYear] = useState<string>(String(new Date().getFullYear()));
  const [schoolId, setSchoolId]                 = useState('');
  const [savingSchool, setSavingSchool]         = useState(false);

  // ── Create admin ─────────────────────────────────────────────────────────
  const [adminEmail, setAdminEmail]       = useState('');
  const [adminName, setAdminName]         = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showNewPwd, setShowNewPwd]       = useState(false);

  // ── Admin list ───────────────────────────────────────────────────────────
  const [admins, setAdmins]               = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // ── View dialog ──────────────────────────────────────────────────────────
  const [viewAdmin, setViewAdmin] = useState<AdminUser | null>(null);

  // ── Edit dialog ──────────────────────────────────────────────────────────
  const [editAdmin, setEditAdmin]     = useState<AdminUser | null>(null);
  const [editName, setEditName]       = useState('');
  const [editEmail, setEditEmail]     = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [savingEdit, setSavingEdit]   = useState(false);

  // ── Delete dialog ────────────────────────────────────────────────────────
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const invokeManageAdmins = async (body: object) => {
    const session = await getSession();
    return supabase.functions.invoke('manage-admins', {
      body,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
  };

  // ── Load school info ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('school_info').select('*').single().then(({ data }) => {
      if (data) {
        setSchoolId(data.id);
        setSchoolName(data.name);
        setSchoolAddress(data.address || '');
        setSchoolCity(data.city || '');
        setActiveSchoolYear(String((data as any).active_school_year || new Date().getFullYear()));
      }
    });
  }, []);

  // ── Load admins ───────────────────────────────────────────────────────────
  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const res = await invokeManageAdmins({ action: 'list' });
      if (res.error || res.data?.error) {
        toast({ title: 'Erro ao carregar administradores', description: res.data?.error || res.error?.message, variant: 'destructive' });
      } else {
        setAdmins(res.data?.admins ?? []);
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setLoadingAdmins(false);
  }, []); // eslint-disable-line

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Save school ───────────────────────────────────────────────────────────
  const handleSaveSchool = async () => {
    const yearNum = parseInt(activeSchoolYear);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      toast({ title: 'Ano letivo inválido', description: 'Informe um ano válido (ex: 2026)', variant: 'destructive' });
      return;
    }
    setSavingSchool(true);
    const payload = { name: schoolName, address: schoolAddress, city: schoolCity, active_school_year: yearNum };
    const { error } = schoolId
      ? await supabase.from('school_info').update(payload).eq('id', schoolId)
      : await supabase.from('school_info').insert(payload);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Configurações salvas!' });
    setSavingSchool(false);
  };

  // ── Create admin ──────────────────────────────────────────────────────────
  const createAdmin = async () => {
    if (!adminEmail || !adminPassword || !adminName) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (adminPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await invokeManageAdmins({ action: 'noop' }); // warm up
      const res2 = await (() => {
        return supabase.functions.invoke('create-user', {
          body: { email: adminEmail, password: adminPassword, name: adminName, role: 'admin' },
          headers: { Authorization: '' },
        });
      })();
      // Use create-user which already exists
      const session = await getSession();
      const result = await supabase.functions.invoke('create-user', {
        body: { email: adminEmail, password: adminPassword, name: adminName, role: 'admin' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (result.error || result.data?.error) {
        const msg = result.data?.error || result.error?.message || 'Erro desconhecido';
        toast({ title: 'Erro ao criar administrador', description: msg, variant: 'destructive' });
      } else {
        toast({ title: 'Administrador criado!', description: `${adminName} já pode acessar o sistema.` });
        setAdminEmail(''); setAdminName(''); setAdminPassword('');
        loadAdmins();
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setCreatingAdmin(false);
  };

  // ── Edit admin ────────────────────────────────────────────────────────────
  const openEdit = (admin: AdminUser) => {
    setEditAdmin(admin);
    setEditName(admin.name);
    setEditEmail(admin.email);
    setEditPassword('');
    setShowEditPwd(false);
  };

  const handleSaveEdit = async () => {
    if (!editAdmin) return;
    if (!editName.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' }); return;
    }
    setSavingEdit(true);
    try {
      const body: Record<string, string> = { action: 'update', userId: editAdmin.user_id, name: editName };
      if (editEmail && editEmail !== editAdmin.email) body.email = editEmail;
      if (editPassword && editPassword.length >= 6) body.password = editPassword;
      if (editPassword && editPassword.length > 0 && editPassword.length < 6) {
        toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
        setSavingEdit(false); return;
      }
      const res = await invokeManageAdmins(body);
      if (res.error || res.data?.error) {
        toast({ title: 'Erro ao salvar', description: res.data?.error || res.error?.message, variant: 'destructive' });
      } else {
        toast({ title: 'Administrador atualizado!' });
        setEditAdmin(null);
        loadAdmins();
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setSavingEdit(false);
  };

  // ── Delete admin ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteAdmin) return;
    setDeleting(true);
    try {
      const res = await invokeManageAdmins({ action: 'delete', userId: deleteAdmin.user_id });
      if (res.error || res.data?.error) {
        toast({ title: 'Erro ao excluir', description: res.data?.error || res.error?.message, variant: 'destructive' });
      } else {
        toast({ title: 'Administrador removido.' });
        setDeleteAdmin(null);
        loadAdmins();
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' });
    }
    setDeleting(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-0.5">Gerencie as configurações do sistema</p>
      </div>

      {/* ── School Info ─────────────────────────────────────────── */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <School className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Dados da Escola</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Escola</Label>
            <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ex: E.M.E.F Roseli Paiva" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
            <div className="space-y-2">
              <Label>Cidade / Estado</Label>
              <Input value={schoolCity} onChange={e => setSchoolCity(e.target.value)} placeholder="Ex: Anajás - PA" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Ano Letivo Vigente
            </Label>
            <Input
              value={activeSchoolYear}
              onChange={e => setActiveSchoolYear(e.target.value)}
              placeholder="Ex: 2026"
              className="w-32"
              maxLength={4}
            />
            <p className="text-xs text-muted-foreground">Aparece nos cabeçalhos dos relatórios.</p>
          </div>
          <Button onClick={handleSaveSchool} disabled={savingSchool} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
            <Save className="w-4 h-4" /> {savingSchool ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </Card>

      {/* ── Administrators List ──────────────────────────────────── */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-foreground">Administradores do Sistema</h2>
            <Badge variant="secondary" className="text-xs">{admins.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAdmins}
            disabled={loadingAdmins}
            className="gap-1 text-muted-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAdmins ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loadingAdmins ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando administradores...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum administrador encontrado.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const isSelf = admin.user_id === user?.id;
                  return (
                    <TableRow key={admin.user_id} className={isSelf ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {admin.name}
                          {isSelf && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/40">
                              Você
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{admin.email || '—'}</TableCell>
                      <TableCell>
                        <Badge className="gradient-primary text-primary-foreground text-xs">
                          👑 Administrador
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(admin.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setViewAdmin(admin)}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEdit(admin)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteAdmin(admin)}
                            disabled={isSelf}
                            title={isSelf ? 'Você não pode excluir sua própria conta' : 'Excluir'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Create Admin ─────────────────────────────────────────── */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Criar Novo Administrador</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Para cadastrar professores, acesse a página <strong>Professores</strong> no menu lateral.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Nome do administrador" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@escola.com" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showNewPwd ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPwd(v => !v)}
              >
                {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button onClick={createAdmin} disabled={creatingAdmin} className="gap-2 gradient-primary text-primary-foreground rounded-xl">
            <Shield className="w-4 h-4" /> {creatingAdmin ? 'Criando...' : 'Criar Administrador'}
          </Button>
        </div>
      </Card>

      {/* ── Current user info ─────────────────────────────────────── */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-foreground">Usuário Atual</h2>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-foreground"><span className="text-muted-foreground">Nome: </span>{profile?.name}</p>
          <p className="text-foreground"><span className="text-muted-foreground">Perfil: </span>
            <span className="capitalize">{profile?.role === 'admin' ? '👑 Administrador' : '🎓 Professor'}</span>
          </p>
        </div>
      </Card>

      {/* ── View Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!viewAdmin} onOpenChange={() => setViewAdmin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Informações do Administrador
            </DialogTitle>
          </DialogHeader>
          {viewAdmin && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Nome</p>
                <p className="font-medium text-foreground">{viewAdmin.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">E-mail</p>
                <p className="text-foreground">{viewAdmin.email || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Perfil</p>
                <Badge className="gradient-primary text-primary-foreground text-xs">👑 Administrador</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Data de Cadastro</p>
                <p className="text-foreground">{formatDate(viewAdmin.created_at)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAdmin(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editAdmin} onOpenChange={() => setEditAdmin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Administrador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Nome completo</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do administrador" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> E-mail</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@escola.com" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Nova Senha <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="relative">
                <Input
                  type={showEditPwd ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEditPwd(v => !v)}
                >
                  {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditAdmin(null)} disabled={savingEdit}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="gradient-primary text-primary-foreground">
              <Check className="w-4 h-4 mr-1" /> {savingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────── */}
      <AlertDialog open={!!deleteAdmin} onOpenChange={() => !deleting && setDeleteAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o administrador <strong>{deleteAdmin?.name}</strong>?
              Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removendo...' : 'Sim, remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
