export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MatchResult = '1' | 'X' | '2'

export type MatchStatus =
  | 'NS'
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'P'
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'SUSP'
  | 'ABD'

export type TournamentPhase =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

export type UserRole = 'participant' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_url?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedSchema: "auth"
          }
        ]
      }
      teams: {
        Row: {
          id: string
          api_football_id: number | null
          name: string
          name_es: string | null
          short_code: string | null
          flag_url: string | null
          group_letter: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          api_football_id?: number | null
          name: string
          name_es?: string | null
          short_code?: string | null
          flag_url?: string | null
          group_letter?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          api_football_id?: number | null
          name?: string
          name_es?: string | null
          short_code?: string | null
          flag_url?: string | null
          group_letter?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          api_football_id: number
          phase: TournamentPhase
          match_number: number | null
          group_letter: string | null
          home_team_id: string | null
          away_team_id: string | null
          kickoff_at: string
          venue: string | null
          city: string | null
          status: MatchStatus
          home_goals_ft: number | null
          away_goals_ft: number | null
          home_goals_aet: number | null
          away_goals_aet: number | null
          home_goals_pen: number | null
          away_goals_pen: number | null
          result_ft: MatchResult | null
          last_synced_at: string | null
          synced_api_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          api_football_id: number
          phase: TournamentPhase
          match_number?: number | null
          group_letter?: string | null
          home_team_id?: string | null
          away_team_id?: string | null
          kickoff_at: string
          venue?: string | null
          city?: string | null
          status?: MatchStatus
          home_goals_ft?: number | null
          away_goals_ft?: number | null
          home_goals_aet?: number | null
          away_goals_aet?: number | null
          home_goals_pen?: number | null
          away_goals_pen?: number | null
          result_ft?: MatchResult | null
          last_synced_at?: string | null
          synced_api_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          api_football_id?: number
          phase?: TournamentPhase
          match_number?: number | null
          group_letter?: string | null
          home_team_id?: string | null
          away_team_id?: string | null
          kickoff_at?: string
          venue?: string | null
          city?: string | null
          status?: MatchStatus
          home_goals_ft?: number | null
          away_goals_ft?: number | null
          home_goals_aet?: number | null
          away_goals_aet?: number | null
          home_goals_pen?: number | null
          away_goals_pen?: number | null
          result_ft?: MatchResult | null
          last_synced_at?: string | null
          synced_api_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            referencedRelation: "teams"
            referencedSchema: "public"
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            referencedRelation: "teams"
            referencedSchema: "public"
          }
        ]
      }
      group_standings: {
        Row: {
          id: string
          group_letter: string
          position: number
          team_id: string
          played: number
          won: number
          drawn: number
          lost: number
          goals_for: number
          goals_against: number
          goal_diff: number
          points: number
          form: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          group_letter: string
          position: number
          team_id: string
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          points?: number
          form?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          group_letter?: string
          position?: number
          team_id?: string
          played?: number
          won?: number
          drawn?: number
          lost?: number
          goals_for?: number
          goals_against?: number
          points?: number
          form?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_standings_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedSchema: "public"
          }
        ]
      }
      golden_boot_predictions: {
        Row: {
          id: string
          user_id: string
          player_name: string
          team_id: string | null
          is_locked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          player_name: string
          team_id?: string | null
          is_locked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          player_name?: string
          team_id?: string | null
          is_locked?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golden_boot_predictions_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedSchema: "public"
          },
          {
            foreignKeyName: "golden_boot_predictions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedSchema: "public"
          }
        ]
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          prediction: MatchResult
          is_locked: boolean
          is_correct: boolean | null
          points_awarded: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          match_id: string
          prediction: MatchResult
          is_locked?: boolean
          is_correct?: boolean | null
          points_awarded?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          match_id?: string
          prediction?: MatchResult
          is_locked?: boolean
          is_correct?: boolean | null
          points_awarded?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            referencedRelation: "matches"
            referencedSchema: "public"
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedSchema: "public"
          }
        ]
      }
      scoring_rules: {
        Row: {
          phase: TournamentPhase
          points_correct: number
          points_wrong: number
          max_points: number
          description: string | null
        }
        Insert: {
          phase: TournamentPhase
          points_correct: number
          points_wrong?: number
          max_points: number
          description?: string | null
        }
        Update: {
          phase?: TournamentPhase
          points_correct?: number
          points_wrong?: number
          max_points?: number
          description?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          user_id: string
          points_group: number
          correct_group: number
          points_round_of_32: number
          correct_round_of_32: number
          points_round_of_16: number
          correct_round_of_16: number
          points_quarter_final: number
          correct_quarter_final: number
          points_semi_final: number
          correct_semi_final: number
          points_third_place: number
          correct_third_place: number
          points_final: number
          correct_final: number
          points_golden_boot: number
          total_points_groups: number
          total_points_playoffs: number
          total_points: number
          updated_at: string
        }
        Insert: {
          user_id: string
          points_group?: number
          correct_group?: number
          points_round_of_32?: number
          correct_round_of_32?: number
          points_round_of_16?: number
          correct_round_of_16?: number
          points_quarter_final?: number
          correct_quarter_final?: number
          points_semi_final?: number
          correct_semi_final?: number
          points_third_place?: number
          correct_third_place?: number
          points_final?: number
          correct_final?: number
          points_golden_boot?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          points_group?: number
          correct_group?: number
          points_round_of_32?: number
          correct_round_of_32?: number
          points_round_of_16?: number
          correct_round_of_16?: number
          points_quarter_final?: number
          correct_quarter_final?: number
          points_semi_final?: number
          correct_semi_final?: number
          points_third_place?: number
          correct_third_place?: number
          points_final?: number
          correct_final?: number
          points_golden_boot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedSchema: "public"
          }
        ]
      }
      sync_logs: {
        Row: {
          id: string
          synced_at: string
          matches_updated: number
          matches_checked: number
          api_calls_used: number
          error_message: string | null
          duration_ms: number | null
          triggered_by: string | null
        }
        Insert: {
          id?: string
          synced_at?: string
          matches_updated?: number
          matches_checked?: number
          api_calls_used?: number
          error_message?: string | null
          duration_ms?: number | null
          triggered_by?: string | null
        }
        Update: {
          id?: string
          synced_at?: string
          matches_updated?: number
          matches_checked?: number
          api_calls_used?: number
          error_message?: string | null
          duration_ms?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          user_id: string
          display_name: string
          avatar_url: string | null
          total_points: number
          total_points_groups: number
          total_points_playoffs: number
          points_golden_boot: number
          final_rounds_correct: number
          golden_boot_correct: boolean
          position: number
        }
      }
      leaderboard_groups: {
        Row: {
          user_id: string
          display_name: string
          avatar_url: string | null
          points: number
          correct_predictions: number
          position: number
        }
      }
      leaderboard_playoffs: {
        Row: {
          user_id: string
          display_name: string
          avatar_url: string | null
          points: number
          correct_predictions: number
          position: number
        }
      }
      match_predictions_summary: {
        Row: {
          match_id: string
          phase: TournamentPhase
          kickoff_at: string
          status: MatchStatus
          result_ft: MatchResult | null
          home_team: string | null
          away_team: string | null
          home_goals_ft: number | null
          away_goals_ft: number | null
          total_predictions: number
          count_1: number
          count_x: number
          count_2: number
          pct_1: number | null
          pct_x: number | null
          pct_2: number | null
        }
      }
    }
  }
}
