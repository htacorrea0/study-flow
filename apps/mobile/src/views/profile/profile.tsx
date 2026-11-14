import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import { LockIcon, MailIcon, UserIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  Card,
  ScreenContainer,
  TextField,
} from "@/components/ui";
import { useSession } from "@/contexts/SessionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/services/api";
import {
  fetchProfile,
  updateNotifications,
  updatePassword,
  updateProfile,
} from "@/services/auth/ProfileService";
import { syncDailyReminder } from "@/services/notifications/DailyReminderService";
import { colors, spacing, typography } from "@/theme";
import { formatStudyDuration } from "@/utils/duration";
import { ScreenTopBar } from "@/views/_templates/_screenTopBar";

function dataDeCadastro(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(iso),
  );
}

export default function Profile() {
  const { status, user, signOut, updateUser } = useSession();
  const { isDark, setMode } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof fetchProfile>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void fetchProfile()
      .then((data) => {
        setProfile(data);
        setName(data.user.name);
        setEmail(data.user.email);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function saveAccount(): Promise<void> {
    setSaving(true);
    try {
      const updated = await updateProfile({ name, email });
      updateUser(updated);
      Alert.alert("Perfil atualizado", "Os dados da sua conta foram salvos.");
    } catch (error) {
      Alert.alert(
        "Não foi possível salvar",
        error instanceof ApiError ? error.message : "Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(): Promise<void> {
    setSaving(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Senha atualizada", "Sua senha foi alterada com sucesso.");
    } catch (error) {
      Alert.alert(
        "Não foi possível alterar a senha",
        error instanceof ApiError ? error.message : "Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleNotifications(enabled: boolean): Promise<void> {
    if (profile === null) return;
    const previous = profile.notifications.studyReminderEnabled;
    setProfile({
      ...profile,
      notifications: {
        ...profile.notifications,
        studyReminderEnabled: enabled,
      },
    });

    try {
      if (enabled) {
        await syncDailyReminder(true, profile.notifications.reminderTime);
      }
      const notifications = await updateNotifications({
        studyReminderEnabled: enabled,
        reminderTime: profile.notifications.reminderTime,
      });
      if (!enabled) {
        await syncDailyReminder(false, notifications.reminderTime);
      }
      setProfile({ ...profile, notifications });
    } catch (error) {
      if (enabled) {
        await syncDailyReminder(
          false,
          profile.notifications.reminderTime,
        ).catch(() => undefined);
      }
      setProfile({
        ...profile,
        notifications: {
          ...profile.notifications,
          studyReminderEnabled: previous,
        },
      });
      Alert.alert(
        "Notificações não alteradas",
        error instanceof ApiError
          ? error.message
          : "Permita as notificações para ativar o lembrete diário.",
      );
    }
  }

  if (status === "loading" || loading) {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Perfil" onBack={router.back} />
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (status === "unauthenticated") {
    return <Redirect href="/login" />;
  }

  if (user === null || profile === null) {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Perfil" onBack={router.back} />
        <Text style={styles.erro}>
          Não foi possível carregar os dados do perfil.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTopBar title="Perfil" onBack={router.back} />

      <View style={styles.conteudo}>
        <View style={styles.identidade}>
          <Avatar
            initials={user.name.slice(0, 1).toUpperCase()}
            name={user.name}
          />
          <View style={styles.nomeGrupo}>
            <Text style={[styles.nome, isDark && styles.textoClaro]}>
              {user.name}
            </Text>
            <Text
              style={[styles.membroDesde, isDark && styles.subtituloEscuro]}
            >
              Membro desde {dataDeCadastro(user.createdAt)}
            </Text>
          </View>
        </View>

        <Card style={[styles.secao, isDark && styles.cardEscuro]}>
          <Text style={[styles.titulo, isDark && styles.textoClaro]}>
            Dados da conta
          </Text>
          {editing ? (
            <>
              <TextField
                label="Nome"
                icon={UserIcon}
                value={name}
                onChangeText={setName}
              />
              <TextField
                label="E-mail"
                icon={MailIcon}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Button
                label="Salvar dados"
                onPress={() => void saveAccount()}
                loading={saving}
              />
            </>
          ) : (
            <>
              <AccountValue label="Nome" value={user.name} isDark={isDark} />
              <AccountValue label="E-mail" value={user.email} isDark={isDark} />
            </>
          )}
        </Card>

        {editing ? (
          <Card style={[styles.secao, isDark && styles.cardEscuro]}>
            <Text style={[styles.titulo, isDark && styles.textoClaro]}>
              Alterar senha
            </Text>
            <TextField
              label="Senha atual"
              icon={LockIcon}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureToggle
            />
            <TextField
              label="Nova senha"
              icon={LockIcon}
              value={newPassword}
              onChangeText={setNewPassword}
              secureToggle
            />
            <Button
              label="Alterar senha"
              variant="secondary"
              onPress={() => void savePassword()}
              loading={saving}
            />
          </Card>
        ) : null}

        {!editing ? (
          <Button label="Editar perfil" onPress={() => setEditing(true)} />
        ) : (
          <Button
            label="Concluir edição"
            variant="secondary"
            onPress={() => setEditing(false)}
          />
        )}

        <Card style={[styles.secao, isDark && styles.cardEscuro]}>
          <Text style={[styles.titulo, isDark && styles.textoClaro]}>
            Preferências
          </Text>
          <PreferenceRow
            label="Notificações diárias"
            value={profile.notifications.studyReminderEnabled}
            onChange={(value) => void toggleNotifications(value)}
          />
          <PreferenceRow
            label="Modo escuro"
            value={isDark}
            onChange={(value) => setMode(value ? "dark" : "light")}
          />
        </Card>

        <Card style={[styles.secao, isDark && styles.cardEscuro]}>
          <Text style={[styles.titulo, isDark && styles.textoClaro]}>
            Métricas
          </Text>
          <Metric
            label="Tempo total estudado"
            value={formatStudyDuration(profile.metrics.totalStudySeconds)}
          />
          <Metric
            label="Sequência atual"
            value={`${profile.metrics.streakDays} ${profile.metrics.streakDays === 1 ? "dia" : "dias"}`}
          />
        </Card>

        <Button
          label="Sair da conta"
          variant="secondary"
          onPress={() => void signOut()}
        />
      </View>
    </ScreenContainer>
  );
}

function PreferenceRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const { isDark } = useTheme();

  return (
    <View style={styles.preferencia}>
      <Text style={[styles.valor, isDark && styles.textoClaro]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? "#c7d2fe" : "#cbd5e1"}
        trackColor={{ false: "#475569", true: colors.primary }}
      />
    </View>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  const { isDark } = useTheme();

  return (
    <View style={styles.preferencia}>
      <Text style={[styles.rotulo, isDark && styles.textoClaro]}>{label}</Text>
      <Text style={[styles.valor, isDark && styles.textoClaro]}>{value}</Text>
    </View>
  );
}

function AccountValue({
  label,
  value,
  isDark,
}: {
  readonly label: string;
  readonly value: string;
  readonly isDark: boolean;
}) {
  return (
    <View style={styles.accountValue}>
      <Text style={[styles.rotulo, isDark && styles.textoClaro]}>{label}</Text>
      <Text style={[styles.valor, isDark && styles.textoClaro]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { gap: spacing.lg, marginTop: spacing.lg },
  identidade: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  nomeGrupo: { flex: 1, gap: spacing.xs },
  nome: { ...typography.sectionTitle },
  membroDesde: { ...typography.caption, color: colors.textMuted },
  secao: { gap: spacing.lg },
  titulo: { ...typography.sectionTitle },
  preferencia: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rotulo: { ...typography.label },
  valor: { ...typography.input, color: colors.textMuted },
  accountValue: { gap: spacing.xs },
  erro: { ...typography.caption, color: colors.textMuted },
  cardEscuro: { backgroundColor: "#1f2937", borderColor: "#374151" },
  textoClaro: { color: "#f8fafc" },
  subtituloEscuro: { color: "#cbd5e1" },
});
