/**
 * Tipos de la base de datos de Supabase.
 *
 * Este archivo se REGENERA automáticamente ejecutando (una vez que tengas
 * el proyecto de Supabase creado y enlazado):
 *
 *   npx supabase gen types typescript --project-id <tu-project-id> > src/lib/types/database.ts
 *
 * Mientras tanto, dejamos aquí a mano el esquema mínimo (tablas de la Fase 1:
 * tenants y profiles) para que el resto del código tenga tipos correctos.
 * No lo edites a mano una vez lo regeneres desde Supabase.
 */

export type Rol = "DUENO" | "ADMIN" | "PROFESOR" | "OPOSITOR";

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          nombre: string;
          slug: string;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          slug: string;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          slug?: string;
          activo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          rol: Rol;
          nombre_completo: string | null;
          email: string;
          creditos: number;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          rol?: Rol;
          nombre_completo?: string | null;
          email: string;
          creditos?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          rol?: Rol;
          nombre_completo?: string | null;
          email?: string;
          creditos?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      mi_rol: {
        Args: Record<string, never>;
        Returns: Rol;
      };
      mi_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      rol_usuario: Rol;
    };
  };
}
