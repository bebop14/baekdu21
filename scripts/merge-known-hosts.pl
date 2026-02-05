#!/usr/bin/env perl

use strict;
use warnings;
use File::Basename qw(dirname);
use Cwd qw(abs_path);
use JSON::PP;
use Encode qw(encode decode);

sub slurp {
  my ($path) = @_;
  local $/ = undef;
  open my $fh, '<:encoding(UTF-8)', $path or die "파일 열기 실패: $path: $!\n";
  my $content = <$fh>;
  close $fh;
  return $content;
}

sub spit {
  my ($path, $content) = @_;
  open my $fh, '>:encoding(UTF-8)', $path or die "파일 쓰기 실패: $path: $!\n";
  print {$fh} $content;
  close $fh;
}

sub strip_trailing_commas {
  my ($json_like) = @_;
  # 간단한 후행 콤마 제거: ",[ ]" 또는 ", }" 패턴
  $json_like =~ s/,\s*\]/\]/g;
  $json_like =~ s/,\s*\}/\}/g;
  return $json_like;
}

sub parse_server_json {
  my ($server_json_path) = @_;
  my $raw = slurp($server_json_path);
  my $sanitized = strip_trailing_commas($raw);
  my $json = JSON::PP->new->utf8->allow_nonref(1);
  my $data = eval { $json->decode($sanitized) };
  if ($@ || !defined $data) {
    die "server.json 파싱 실패. 파일 내용을 확인하세요.\n$@";
  }
  return $data;
}

sub extract_hosts_from_known_hosts {
  my ($content) = @_;
  my %hosts;
  for my $line (split /\r?\n/, $content) {
    $line =~ s/^\s+|\s+$//g; # trim
    next if $line eq '';
    next if $line =~ /^#/;     # comment
    my ($first_token) = split /\s+/, $line, 2;
    next unless defined $first_token && $first_token ne '';
    for my $h (split /,/, $first_token) {
      $h =~ s/^\s+|\s+$//g;
      next if $h eq '';
      $hosts{$h} = 1;
    }
  }
  return [ sort keys %hosts ];
}

sub ensure_hosts_in_profiles {
  my ($server_obj, $hosts_to_add) = @_;
  die "server.json에 profiles 배열이 없습니다.\n" unless ref($server_obj->{profiles}) eq 'ARRAY';

  for my $profile (@{ $server_obj->{profiles} }) {
    $profile->{hosts} = [] unless ref($profile->{hosts}) eq 'ARRAY';

    my %existing = map {
      my $hn = (ref($_) eq 'HASH') ? ($_->{hostname} // '') : '';
      ($hn ne '' ? ($hn => 1) : ())
    } @{ $profile->{hosts} };

    my @additions;
    for my $host (@$hosts_to_add) {
      next if exists $existing{$host};
      push @additions, { hostname => $host, description => '' };
      $existing{$host} = 1;
    }

    push @{ $profile->{hosts} }, @additions if @additions;
  }
}

sub main {
  my $script_dir = dirname(abs_path($0));
  my $project_root = abs_path("$script_dir/..");
  my $known_hosts_path = "$project_root/.known_hosts";
  my $server_json_path = "$project_root/server.json";

  -e $known_hosts_path or die "파일 없음: $known_hosts_path\n";
  -e $server_json_path or die "파일 없음: $server_json_path\n";

  my $known_hosts_content = slurp($known_hosts_path);
  my $hosts_from_known = extract_hosts_from_known_hosts($known_hosts_content);

  if (!@$hosts_from_known) {
    print "추가할 호스트가 없습니다.\n";
    exit 0;
  }

  my $server_obj = parse_server_json($server_json_path);
  ensure_hosts_in_profiles($server_obj, $hosts_from_known);

  my $json = JSON::PP->new->utf8->pretty(1)->canonical(0);
  my $output = $json->encode($server_obj);
  $output .= "\n" unless $output =~ /\n\z/;
  spit($server_json_path, $output);

  printf "병합 완료: %d개 후보를 처리했습니다.\n", scalar(@$hosts_from_known);
}

main();

