export interface User {
  id: string
  email: string
  full_name: string
  username?: string
  avatar_url?: string
  bio?: string
  skills: string[]
  role: 'client' | 'freelancer' | 'both'
  is_verified: boolean
  wallet_balance: number
  total_earnings: number
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  category: string
  budget_min: number
  budget_max: number
  deadline?: string
  location?: string
  tags: string[]
  images: string[]
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed'
  creator_id: string
  creator?: User
  views_count: number
  applications_count: number
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  task_id: string
  freelancer_id: string
  freelancer?: User
  task?: Task
  cover_letter: string
  proposed_budget: number
  proposed_timeline?: string
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  created_at: string
}

export interface Store {
  id: string
  owner_id: string
  owner?: User
  name: string
  slug: string
  description?: string
  logo_url?: string
  banner_url?: string
  category?: string
  tags: string[]
  contact_email?: string
  contact_phone?: string
  website?: string
  status: 'active' | 'suspended' | 'pending'
  products: Product[]
  created_at: string
}

export interface Product {
  id: string
  store_id: string
  title: string
  description?: string
  price: number
  images: string[]
  category?: string
  is_service: boolean
  is_active: boolean
  delivery_time?: string
  created_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  link?: string
  data: Record<string, unknown>
  created_at: string
}

export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'escrow' | 'release' | 'refund'
  amount: number
  currency: string
  status: string
  description?: string
  created_at: string
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface AdminStats {
  total_users: number
  total_tasks: number
  total_stores: number
  total_applications: number
  total_transactions_volume: number
  new_users_today: number
  new_tasks_today: number
  open_tasks: number
  banned_users: number
}

export const TASK_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'UI/UX Design',
  'Graphic Design',
  'Content Writing',
  'Digital Marketing',
  'SEO',
  'Data Science',
  'Machine Learning',
  'Video Editing',
  'Photography',
  'Translation',
  'Legal',
  'Accounting',
  'Consulting',
  'Virtual Assistant',
  'Customer Support',
  'Other',
] as const

export const TASK_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}
