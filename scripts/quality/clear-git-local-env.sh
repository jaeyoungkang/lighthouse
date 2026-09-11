git_local_env_vars="$(git rev-parse --local-env-vars)" || exit 1

for git_local_env_var in $git_local_env_vars; do
  unset "$git_local_env_var"
done

unset git_local_env_var git_local_env_vars
