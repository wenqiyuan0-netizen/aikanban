export const nowISO = () => new Date().toISOString();

export const toUtcIso = (localDt) => {
        if (!localDt) return undefined;
        try {
                const date = new Date(localDt);
                return isNaN(date.getTime()) ? undefined : date.toISOString();
        } catch {
                return undefined;
        }
};

export const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export const daysBetween = (a, b) => {
        try {
                const x = new Date(a);
                const y = new Date(b);
                if (isNaN(x) || isNaN(y)) return null;
                return (y - x) / 86400000;
        } catch {
                return null;
        }
};
