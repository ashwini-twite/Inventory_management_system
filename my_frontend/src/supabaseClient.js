import { createClient } from "@supabase/supabase-js";



// Your project URL and public anon key (Settings → API)

const supabaseUrl = "https://yfcmozsmpsiswehhwcfn.supabase.co";

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY21venNtcHNpc3dlaGh3Y2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTc3MTIsImV4cCI6MjA3ODk3MzcxMn0.UQVcxbv-P6rm70iTepQIVz7Qw584NtJTNitoyS0EAGQ";



export const supabase = createClient(supabaseUrl, supabaseKey);
