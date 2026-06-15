import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, BookOpen, TrendingUp, Sparkles } from 'lucide-react';
import { FluencyResult, PROFILE_LABELS, PROFILE_COLORS } from '@/lib/fluency';
import Gauge from './Gauge';

interface Props { result: FluencyResult }

const FluencyDashboard: React.FC<Props> = ({ result }) => {
  const data = (['pl1','pl2','pl3','pl4','li','lf'] as const)
    .map(k => ({ name: PROFILE_LABELS[k], value: result[k], color: PROFILE_COLORS[k] }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="Estudantes Avaliados" value={String(result.total)} color="bg-blue-600" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} label="Taxa de Leitores" value={`${result.taxaLeitores.toFixed(1)}%`} color="bg-emerald-600" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Índice de Fluência (IFL)" value={result.ifl.toFixed(2)} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Perfil</CardTitle></CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => `${((e.percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Velocímetro IFL</CardTitle></CardHeader>
          <CardContent><Gauge value={result.ifl} max={10} label={result.classification} color={result.classificationColor} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Velocímetro Taxa de Leitores</CardTitle></CardHeader>
          <CardContent><Gauge value={result.taxaLeitores} max={100} label="% de Leitores" suffix="%" color="#16a34a" /></CardContent>
        </Card>
      </div>

      <Card className="border-l-4" style={{ borderLeftColor: result.classificationColor }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Diagnóstico Automático
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{result.diagnostico}</p>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <Card className="overflow-hidden">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`${color} text-white p-3 rounded-xl shadow-md flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default FluencyDashboard;
